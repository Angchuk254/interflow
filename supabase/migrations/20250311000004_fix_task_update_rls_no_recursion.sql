-- Fix "infinite recursion detected in policy for relation 'tasks'"
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run
--
-- The previous policy caused recursion because subqueries triggered RLS on
-- task_assignees/profiles/project_managers, which may reference tasks again.
-- Using a SECURITY DEFINER function bypasses RLS during the check.

-- Step 1: Create helper function (runs as owner, bypasses RLS - no recursion)
CREATE OR REPLACE FUNCTION public.can_update_task(p_task_id uuid, p_project_id uuid, p_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (SELECT 1 FROM project_managers WHERE project_id = p_project_id AND user_id = auth.uid())
  OR p_created_by = auth.uid();
$$;

-- Step 2: Drop ALL existing UPDATE policies on tasks
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'tasks' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
  END LOOP;
END $$;

-- Step 3: Create policy using the function (no subqueries = no recursion)
CREATE POLICY "Allow task updates for assignees and managers"
ON public.tasks
FOR UPDATE
TO authenticated
USING (can_update_task(id, project_id, created_by))
WITH CHECK (true);
