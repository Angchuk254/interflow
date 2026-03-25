-- Version history for cost estimates (PM + Finance); visible to both sides while respecting estimate RLS.

CREATE TABLE public.project_finance_estimate_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_finance_estimates (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  summary text NOT NULL,
  margin_percent numeric(12, 2) NOT NULL,
  status text NOT NULL,
  lines_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_finance_estimate_revisions_estimate_id ON public.project_finance_estimate_revisions (estimate_id, created_at DESC);

ALTER TABLE public.project_finance_estimate_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_estimate_revisions_select"
  ON public.project_finance_estimate_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = project_finance_estimate_revisions.estimate_id
        AND (
          e.submitted_by = auth.uid()
          OR public.is_finance_or_admin()
          OR (
            e.project_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.project_managers pm
              WHERE pm.project_id = e.project_id AND pm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- PM while not approved, or Finance/admin (including recording "Approved" snapshot).
CREATE POLICY "finance_estimate_revisions_insert"
  ON public.project_finance_estimate_revisions
  FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = estimate_id
        AND (
          (
            e.submitted_by = auth.uid()
            AND public.is_manager_or_admin()
            AND e.status <> 'approved'
          )
          OR public.is_finance_or_admin()
        )
    )
  );
