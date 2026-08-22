import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch {
    return new Response(JSON.stringify({ error: "Expected multipart/form-data with an audio file" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1024) {
    return new Response(JSON.stringify({ error: "That recording was empty — please try again." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (file.size > 20 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Recording too long — keep it under 20MB." }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const upstream = new FormData();
  upstream.append("model", "openai/gpt-4o-mini-transcribe");
  upstream.append("file", file, "recording.wav");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: upstream,
  });

  const text = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Transcription failed (${res.status})`, detail: text.slice(0, 400) }), {
      status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let transcript = "";
  try { transcript = JSON.parse(text)?.text || ""; } catch { transcript = text; }
  return new Response(JSON.stringify({ text: transcript }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
