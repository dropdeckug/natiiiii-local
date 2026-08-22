
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  step_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  trigger TEXT NOT NULL DEFAULT 'user',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_project ON public.agent_runs(project_id, started_at DESC);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent runs" ON public.agent_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own agent runs" ON public.agent_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own agent runs" ON public.agent_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own agent runs" ON public.agent_runs FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.agent_run_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  idx INTEGER NOT NULL,
  tool TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_excerpt TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_run_steps_run ON public.agent_run_steps(run_id, idx);

ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent run steps" ON public.agent_run_steps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own agent run steps" ON public.agent_run_steps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own agent run steps" ON public.agent_run_steps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own agent run steps" ON public.agent_run_steps FOR DELETE USING (auth.uid() = user_id);
