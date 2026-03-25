-- Finance estimates: PM submits, Finance reviews; realtime-enabled tables.

-- ---------------------------------------------------------------------------
-- Helper: finance or admin (used in RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_finance_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'finance')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_finance_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  custom_title text,
  margin_percent numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_finance_estimates_project_or_title CHECK (
    project_id IS NOT NULL
    OR (custom_title IS NOT NULL AND length(trim(custom_title)) > 0)
  )
);

CREATE INDEX idx_project_finance_estimates_submitted_by ON public.project_finance_estimates (submitted_by);
CREATE INDEX idx_project_finance_estimates_status_updated ON public.project_finance_estimates (status, updated_at DESC);

CREATE TABLE public.finance_estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_finance_estimates (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  resource_label text NOT NULL DEFAULT '',
  hours numeric(12, 2) NOT NULL DEFAULT 0,
  rate_per_hour numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_estimate_lines_estimate_id ON public.finance_estimate_lines (estimate_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_project_finance_estimates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_finance_estimates_updated_at
  BEFORE UPDATE ON public.project_finance_estimates
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_project_finance_estimates_updated_at();

CREATE OR REPLACE FUNCTION public.touch_finance_estimate_lines_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_finance_estimate_lines_updated_at
  BEFORE UPDATE ON public.finance_estimate_lines
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_finance_estimate_lines_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: estimates
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_finance_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_finance_estimates_select"
  ON public.project_finance_estimates
  FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR public.is_finance_or_admin()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.project_managers pm
        WHERE pm.project_id = project_finance_estimates.project_id
          AND pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "project_finance_estimates_insert"
  ON public.project_finance_estimates
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.is_manager_or_admin()
  );

-- PM: edit own estimate until Finance approves (cannot set status to approved via RLS check).
CREATE POLICY "project_finance_estimates_pm_update"
  ON public.project_finance_estimates
  FOR UPDATE
  USING (
    submitted_by = auth.uid()
    AND public.is_manager_or_admin()
    AND status <> 'approved'
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND status <> 'approved'
  );

-- Finance / admin: edit while not approved; approving sets status to approved (last allowed update for that row).
CREATE POLICY "project_finance_estimates_finance_update"
  ON public.project_finance_estimates
  FOR UPDATE
  USING (
    public.is_finance_or_admin()
    AND status <> 'approved'
  )
  WITH CHECK (public.is_finance_or_admin());

-- ---------------------------------------------------------------------------
-- RLS: lines (inherit access via parent estimate)
-- ---------------------------------------------------------------------------
ALTER TABLE public.finance_estimate_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_estimate_lines_select"
  ON public.finance_estimate_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = finance_estimate_lines.estimate_id
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

CREATE POLICY "finance_estimate_lines_insert"
  ON public.finance_estimate_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = finance_estimate_lines.estimate_id
        AND e.status <> 'approved'
        AND (
          (
            e.submitted_by = auth.uid()
            AND public.is_manager_or_admin()
          )
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "finance_estimate_lines_update"
  ON public.finance_estimate_lines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = finance_estimate_lines.estimate_id
        AND e.status <> 'approved'
        AND (
          (
            e.submitted_by = auth.uid()
            AND public.is_manager_or_admin()
          )
          OR public.is_finance_or_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = finance_estimate_lines.estimate_id
        AND e.status <> 'approved'
        AND (
          (
            e.submitted_by = auth.uid()
            AND public.is_manager_or_admin()
          )
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "finance_estimate_lines_delete"
  ON public.finance_estimate_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_finance_estimates e
      WHERE e.id = finance_estimate_lines.estimate_id
        AND e.status <> 'approved'
        AND (
          (
            e.submitted_by = auth.uid()
            AND public.is_manager_or_admin()
          )
          OR public.is_finance_or_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (Supabase)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_finance_estimates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_estimate_lines;
