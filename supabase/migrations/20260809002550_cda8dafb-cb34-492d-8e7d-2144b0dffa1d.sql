CREATE TABLE IF NOT EXISTS public.project_cpr (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cpr_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  compatibility TEXT NOT NULL DEFAULT 'supported',
  framework TEXT,
  framework_label TEXT,
  build_tool TEXT,
  build_tool_label TEXT,
  package_manager TEXT NOT NULL DEFAULT 'npm',
  node_version TEXT NOT NULL DEFAULT '20',
  capacitor_major INTEGER NOT NULL DEFAULT 7,
  app_root TEXT NOT NULL DEFAULT '',
  install_command TEXT,
  build_command TEXT,
  output_dir TEXT,
  output_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_confidence TEXT NOT NULL DEFAULT 'medium',
  blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  quick_scan JSONB,
  dependency_audit JSONB,
  transform_summary JSONB,
  verify_result JSONB,
  report JSONB,
  original_package_json JSONB,
  canonical_package_json JSONB,
  canonical_path TEXT,
  canonical_checksum TEXT,
  blocking BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT project_cpr_project_unique UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cpr TO authenticated;
GRANT ALL ON public.project_cpr TO service_role;

ALTER TABLE public.project_cpr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own CPR records"
ON public.project_cpr FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS project_cpr_project_id_idx ON public.project_cpr(project_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_project_cpr_updated_at ON public.project_cpr;
CREATE TRIGGER update_project_cpr_updated_at
BEFORE UPDATE ON public.project_cpr
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();