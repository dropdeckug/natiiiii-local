-- Create plugin_secrets table for storing plugin credentials
CREATE TABLE IF NOT EXISTS public.plugin_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  secret_key text NOT NULL,
  secret_value text,
  file_path text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id, plugin_id, secret_key)
);

ALTER TABLE public.plugin_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own plugin secrets"
  ON public.plugin_secrets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
