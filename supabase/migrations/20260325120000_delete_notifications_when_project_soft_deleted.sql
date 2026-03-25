-- When a project is soft-deleted (deleted_at set), remove in-app notifications whose link
-- points at that project. Notifications only store paths like /projects/<uuid>, not FKs.

CREATE OR REPLACE FUNCTION public.delete_notifications_for_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.notifications
    WHERE link IS NOT NULL
      AND (
        link = '/projects/' || NEW.id::text
        OR link LIKE '/projects/' || NEW.id::text || '/%'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_notifications_on_project_soft_delete ON public.projects;

CREATE TRIGGER trg_delete_notifications_on_project_soft_delete
  AFTER UPDATE OF deleted_at ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_notifications_for_project();
