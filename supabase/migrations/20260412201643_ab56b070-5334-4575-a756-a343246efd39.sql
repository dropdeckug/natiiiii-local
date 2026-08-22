
-- Create project_snapshots table
CREATE TABLE public.project_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_hash TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  size_kb NUMERIC NOT NULL DEFAULT 0,
  plugin_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  config_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_project_snapshots_project ON public.project_snapshots(project_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
ON public.project_snapshots FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own snapshots"
ON public.project_snapshots FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
ON public.project_snapshots FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add build_metadata to builds table for incremental build support
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS build_metadata JSONB DEFAULT '{}'::jsonb;

-- Create project-files storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- RLS policies for project-files bucket
CREATE POLICY "Users can upload own project files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own project files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own project files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own project files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create keystores storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('keystores', 'keystores', false);

CREATE POLICY "Users can upload own keystores"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'keystores' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own keystores"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'keystores' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own keystores"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'keystores' AND auth.uid()::text = (storage.foldername(name))[1]);
