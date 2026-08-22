CREATE TABLE public.build_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  phase TEXT NOT NULL DEFAULT 'validating',
  status TEXT NOT NULL DEFAULT 'running',
  repo_name TEXT,
  run_id BIGINT,
  commit_sha TEXT,
  model TEXT,
  diagnostic TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX idx_build_runs_project_active ON public.build_runs (project_id, started_at DESC) WHERE status = 'running';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_runs TO authenticated;
GRANT ALL ON public.build_runs TO service_role;
ALTER TABLE public.build_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own build runs" ON public.build_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own build runs" ON public.build_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own build runs" ON public.build_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own build runs" ON public.build_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_build_runs_updated_at BEFORE UPDATE ON public.build_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();