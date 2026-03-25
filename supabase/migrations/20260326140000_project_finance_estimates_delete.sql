-- Allow submitters (PM) to remove their own estimates before approval; Finance/admin can remove any non-approved estimate.

CREATE POLICY "project_finance_estimates_delete"
  ON public.project_finance_estimates
  FOR DELETE
  USING (
    status <> 'approved'
    AND (
      (
        submitted_by = auth.uid()
        AND public.is_manager_or_admin()
      )
      OR public.is_finance_or_admin()
    )
  );
