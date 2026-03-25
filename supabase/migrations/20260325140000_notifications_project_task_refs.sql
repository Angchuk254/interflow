-- Link notifications to projects/tasks for reliable cleanup when either is soft-deleted.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON public.notifications (task_id)
  WHERE task_id IS NOT NULL;

-- Replace project handler: delete by FK or legacy link pattern.
CREATE OR REPLACE FUNCTION public.delete_notifications_for_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.notifications
    WHERE project_id = NEW.id
       OR (
        link IS NOT NULL
        AND (
          link = '/projects/' || NEW.id::text
          OR link LIKE '/projects/' || NEW.id::text || '/%'
        )
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_notifications_for_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.notifications WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_notifications_on_task_soft_delete ON public.tasks;

CREATE TRIGGER trg_delete_notifications_on_task_soft_delete
  AFTER UPDATE OF deleted_at ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_notifications_for_task();
