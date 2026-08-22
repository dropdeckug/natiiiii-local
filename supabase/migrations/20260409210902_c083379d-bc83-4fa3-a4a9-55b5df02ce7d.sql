-- Create storage bucket for APK artifacts
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('build-artifacts', 'build-artifacts', false, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own build artifacts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'build-artifacts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can read their own artifacts
CREATE POLICY "Users can read own build artifacts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'build-artifacts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can update (replace) their own artifacts
CREATE POLICY "Users can update own build artifacts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'build-artifacts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can delete their own artifacts
CREATE POLICY "Users can delete own build artifacts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'build-artifacts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add source_repo_name column for incremental rebuilds
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS source_repo_name text;