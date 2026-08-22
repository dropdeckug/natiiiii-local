CREATE TABLE public.keystores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_alias text NOT NULL,
  sha1 text,
  sha256 text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key_alias)
);
ALTER TABLE public.keystores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keystores" ON public.keystores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);