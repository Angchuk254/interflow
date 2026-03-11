-- Allow task assignees to update task status (fixes "Failed to start task" for employees)
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run
--
-- If you get "policy already exists", first run:
--   DROP POLICY IF EXISTS "Assignees can update assigned tasks" ON public.tasks;

CREATE POLICY "Assignees can update assigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  -- User is an assignee of this task
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
  OR
  -- User is admin
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR
  -- User is project manager
  EXISTS (
    SELECT 1 FROM public.project_managers pm
    WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
  )
  OR
  -- User created the task
  tasks.created_by = auth.uid()
)
WITH CHECK (true);
