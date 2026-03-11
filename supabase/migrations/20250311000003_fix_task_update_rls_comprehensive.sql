-- Comprehensive fix for "Failed to update task status"
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run
--
-- This ensures:
-- 1. task_assignees: users can read their own rows (needed for RLS subquery)
-- 2. tasks: assignees, admins, managers, and creators can UPDATE

-- Step 1: Ensure task_assignees has SELECT policy for users to read their assignments
-- (Required for the tasks UPDATE policy's EXISTS subquery to work)
DROP POLICY IF EXISTS "Users can read own task assignments" ON public.task_assignees;
CREATE POLICY "Users can read own task assignments"
ON public.task_assignees
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

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

-- Step 3: Create policy allowing task updates for assignees, admins, managers, creator
CREATE POLICY "Allow task updates for assignees and managers"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.project_managers pm
    WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
  )
  OR tasks.created_by = auth.uid()
)
WITH CHECK (true);

-- Verify: Run this to check policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('tasks', 'task_assignees') ORDER BY tablename;
