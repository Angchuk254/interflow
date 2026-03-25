-- Bump parent estimate updated_at when line items change so PM inbox realtime sees Finance edits.

CREATE OR REPLACE FUNCTION public.touch_estimate_on_line_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    eid := OLD.estimate_id;
  ELSE
    eid := NEW.estimate_id;
  END IF;
  IF eid IS NOT NULL THEN
    UPDATE public.project_finance_estimates SET updated_at = now() WHERE id = eid;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_lines_touch_estimate ON public.finance_estimate_lines;

CREATE TRIGGER trg_finance_lines_touch_estimate
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_estimate_lines
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_estimate_on_line_change();
