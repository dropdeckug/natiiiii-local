
ALTER TABLE public.project_sources
  ADD COLUMN IF NOT EXISTS app_root text,
  ADD COLUMN IF NOT EXISTS build_command_override text,
  ADD COLUMN IF NOT EXISTS output_dir text;

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS region;
