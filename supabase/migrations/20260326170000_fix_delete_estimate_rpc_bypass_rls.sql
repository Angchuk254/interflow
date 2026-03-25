-- Fix delete_project_finance_estimate returning false despite valid callers:
-- DELETE inside SECURITY DEFINER still evaluates RLS for the session user unless the
-- function owner bypasses RLS. SET LOCAL row_security = off (runs as function owner,
-- typically a superuser) ensures only the explicit WHERE clause applies.
-- Authorization remains: non-approved row AND (submitter OR finance/admin via profiles).

CREATE OR REPLACE FUNCTION public.delete_project_finance_estimate(estimate_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SET LOCAL row_security = off;

  DELETE FROM public.project_finance_estimates e
  WHERE e.id = estimate_id
    AND e.status IS DISTINCT FROM 'approved'
    AND (
      e.submitted_by = uid
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = uid AND p.role IN ('admin', 'finance')
      )
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project_finance_estimate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project_finance_estimate(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_project_finance_estimate(uuid) IS
  'Deletes a non-approved estimate if caller is submitter or finance/admin. Uses row_security=off with explicit checks.';
