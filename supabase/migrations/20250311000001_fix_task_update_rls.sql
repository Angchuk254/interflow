-- Fix: Allow task assignees (employees in approved projects) to update task status
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run
--
-- This fixes "Failed to start task. You may not have permission to update this task"
-- when an employee who is assigned to a task tries to start it.

-- Step 1: Drop ALL existing UPDATE policies on tasks (avoids conflicts)
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

-- Step 2: Create a single policy that allows task updates for:
-- - Task assignees (employees assigned to the task)
-- - Admins
-- - Project managers
-- - Task creator
CREATE POLICY "Allow task updates for assignees and managers"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  -- User is assigned to this task
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
  OR
  -- User is admin
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  OR
  -- User is project manager for this project
  EXISTS (
    SELECT 1 FROM public.project_managers pm
    WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
  )
  OR
  -- User created the task
  tasks.created_by = auth.uid()
)
WITH CHECK (true);

-- Verify: Run this to check policies were created:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tasks';
