-- Reliable deletes: SECURITY DEFINER RPC bypasses RLS quirks on DELETE/RETURNING while enforcing the same rules.

CREATE OR REPLACE FUNCTION public.delete_project_finance_estimate(estimate_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.project_finance_estimates e
  WHERE e.id = estimate_id
    AND e.status IS DISTINCT FROM 'approved'
    AND (
      e.submitted_by = auth.uid()
      OR public.is_finance_or_admin()
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project_finance_estimate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project_finance_estimate(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_project_finance_estimate(uuid) IS
  'Deletes a non-approved estimate if caller is submitter or finance/admin. Returns true when a row was removed.';
