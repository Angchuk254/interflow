-- Allow project managers and creators to archive/unarchive and delete projects
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run
--
-- This enables managers (and project creators) to disable, enable, and delete
-- projects they manage, not just admins.

-- Step 1: Drop existing UPDATE policies on projects (if any)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END $$;

-- Step 2: Create policy allowing project updates for admins, creators, and managers
CREATE POLICY "Allow project updates for admins creators and managers"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  -- User is admin
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  OR
  -- User created the project
  projects.created_by = auth.uid()
  OR
  -- User is project manager for this project
  EXISTS (
    SELECT 1 FROM public.project_managers pm
    WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
  )
)
WITH CHECK (true);
