ALTER TABLE public.project_index
  ADD COLUMN IF NOT EXISTS build_tool text,
  ADD COLUMN IF NOT EXISTS build_tool_label text,
  ADD COLUMN IF NOT EXISTS output_dir_source text,
  ADD COLUMN IF NOT EXISTS static_capable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS static_blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS node_version text,
  ADD COLUMN IF NOT EXISTS normalization jsonb NOT NULL DEFAULT '{}'::jsonb;