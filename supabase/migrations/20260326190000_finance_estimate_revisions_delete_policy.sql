-- Revisions had SELECT/INSERT but no DELETE policy. With RLS enabled, CASCADE deletes from
-- project_finance_estimates were blocked on child rows, so REST DELETE removed 0 rows silently.
-- Mirror the same rules as project_finance_estimates_delete.

CREATE POLICY "finance_estimate_revisions_delete"
  ON public.project_finance_estimate_revisions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = project_finance_estimate_revisions.estimate_id
        AND e.status IS DISTINCT FROM 'approved'
        AND (
          e.submitted_by = auth.uid()
          OR public.is_finance_or_admin()
        )
    )
  );
