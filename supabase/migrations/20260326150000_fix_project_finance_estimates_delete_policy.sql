-- Replace DELETE policy so:
-- - The creator can always delete their own non-approved row (no extra role check; INSERT already limits who creates).
-- - Finance and admin can delete any non-approved estimate.

DROP POLICY IF EXISTS "project_finance_estimates_delete" ON public.project_finance_estimates;

CREATE POLICY "project_finance_estimates_delete"
  ON public.project_finance_estimates
  FOR DELETE
  USING (
    status <> 'approved'
    AND (
      submitted_by = auth.uid()
      OR public.is_finance_or_admin()
    )
  );

-- Allow finance (and admin via is_finance_or_admin) to submit new estimates, not only managers.
DROP POLICY IF EXISTS "project_finance_estimates_insert" ON public.project_finance_estimates;

CREATE POLICY "project_finance_estimates_insert"
  ON public.project_finance_estimates
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND (
      public.is_manager_or_admin()
      OR public.is_finance_or_admin()
    )
  );
