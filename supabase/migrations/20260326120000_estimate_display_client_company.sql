-- Optional finance label override plus client / company for project finance estimates.

ALTER TABLE public.project_finance_estimates
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN public.project_finance_estimates.display_name IS
  'Optional title shown in finance; when set, overrides linked project title for lists and PDFs.';
COMMENT ON COLUMN public.project_finance_estimates.client_name IS 'Client name for this estimate.';
COMMENT ON COLUMN public.project_finance_estimates.company_name IS 'Client company name for this estimate.';
