-- project_finance_estimate_revisions has RLS but no DELETE policy. CASCADE from the parent can
-- therefore fail when child deletes run under the session user. Delete dependents explicitly
-- inside the SECURITY DEFINER RPC with row_security off after the same authorization check.

CREATE OR REPLACE FUNCTION public.delete_project_finance_estimate(estimate_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  uid uuid := auth.uid();
  authorized boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SET LOCAL row_security = off;

  SELECT EXISTS (
    SELECT 1
    FROM public.project_finance_estimates e
    WHERE e.id = estimate_id
      AND e.status IS DISTINCT FROM 'approved'
      AND (
        e.submitted_by = uid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = uid AND p.role IN ('admin', 'finance')
        )
      )
  )
  INTO authorized;

  IF NOT authorized THEN
    RETURN false;
  END IF;

  DELETE FROM public.finance_estimate_lines WHERE estimate_id = estimate_id;
  DELETE FROM public.project_finance_estimate_revisions WHERE estimate_id = estimate_id;
  DELETE FROM public.project_finance_estimates WHERE id = estimate_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project_finance_estimate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project_finance_estimate(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_project_finance_estimate(uuid) IS
  'Deletes lines, revisions, then estimate after auth. Avoids CASCADE + RLS on revisions (no DELETE policy).';
