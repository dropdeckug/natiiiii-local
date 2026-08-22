import { supabase } from "@/integrations/supabase/client";

export interface AppearanceRow {
  id?: string;
  project_id: string;
  user_id?: string;
  icon_foreground_path: string | null;
  icon_background_color: string;
  icon_padding_pct: number;
  icon_corner_radius_pct: number;
  icon_letter_fallback: string | null;
  status_bar_visible: boolean;
  status_bar_color: string;
  status_bar_color_dark: string;
  status_bar_style: "light" | "dark" | "auto";
  splash_bg_color: string;
  splash_bg_color_dark: string;
  splash_image_path: string | null;
  splash_duration_ms: number;
  splash_resize_mode: "contain" | "cover" | "fill";
  edge_to_edge_enabled: boolean;
  edge_to_edge_nav_color: string;
  default_theme: "light" | "dark" | "system";
  staged: boolean;
}

export const defaultAppearance = (projectId: string): AppearanceRow => ({
  project_id: projectId,
  icon_foreground_path: null,
  icon_background_color: "#4F46E5",
  icon_padding_pct: 15,
  icon_corner_radius_pct: 22,
  icon_letter_fallback: "A",
  status_bar_visible: true,
  status_bar_color: "#FFFFFF",
  status_bar_color_dark: "#000000",
  status_bar_style: "auto",
  splash_bg_color: "#FFFFFF",
  splash_bg_color_dark: "#000000",
  splash_image_path: null,
  splash_duration_ms: 3000,
  splash_resize_mode: "contain",
  edge_to_edge_enabled: false,
  edge_to_edge_nav_color: "#00000000",
  default_theme: "system",
  staged: true,
});

export async function loadAppearance(projectId: string): Promise<AppearanceRow | null> {
  const { data, error } = await supabase
    .from("appearance_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data as AppearanceRow | null;
}

export async function upsertAppearance(row: AppearanceRow): Promise<AppearanceRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const payload = { ...row, user_id: user.id, staged: true };
  const { data, error } = await supabase
    .from("appearance_configs")
    .upsert(payload, { onConflict: "project_id" })
    .select()
    .single();
  if (error) throw error;
  return data as AppearanceRow;
}

export async function uploadAppearanceAsset(
  projectId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const path = `${user.id}/${projectId}/${filename}`;
  const { error } = await supabase.storage
    .from("appearance-assets")
    .upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function getAppearanceAssetUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("appearance-assets")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
