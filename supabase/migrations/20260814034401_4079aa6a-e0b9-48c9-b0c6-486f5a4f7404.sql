CREATE TABLE IF NOT EXISTS public.user_ai_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  agent_mode TEXT NOT NULL DEFAULT 'chat',
  effort TEXT NOT NULL DEFAULT 'balanced',
  default_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  provider TEXT NOT NULL DEFAULT 'google-ai-studio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_preferences TO authenticated;
GRANT ALL ON public.user_ai_preferences TO service_role;

ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI preferences"
ON public.user_ai_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_user_ai_preferences_updated_at ON public.user_ai_preferences;
CREATE TRIGGER update_user_ai_preferences_updated_at
BEFORE UPDATE ON public.user_ai_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();