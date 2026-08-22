import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectApp {
  id: string;
  project_id: string;
  platform: string;
  engine: string | null;
  display_name: string | null;
  package_id: string | null;
  version_name: string | null;
  version_code: number | null;
  min_sdk: number | null;
  target_sdk: number | null;
  signing_sha1: string | null;
  signing_sha256: string | null;
  build_output_dir: string | null;
  webdir: string | null;
  status: string | null;
  last_build_id: string | null;
  render_verified: boolean | null;
  render_screenshot_url: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function useProjectApps(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_apps", projectId],
    queryFn: async (): Promise<ProjectApp[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_apps")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectApp[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
