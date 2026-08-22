// Server-side GitHub zipball proxy.
// Browsers cannot fetch api.github.com/.../zipball directly because GitHub
// redirects to codeload.github.com, which does not send CORS headers.
// This function follows the redirect server-side and streams the zip back
// with proper CORS headers so the wizard can read the bytes.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-github-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    let fullName = url.searchParams.get("repo") || "";
    let ref = url.searchParams.get("ref") || "";
    let token = req.headers.get("x-github-token") || "";

    if (req.method === "POST") {
      try {
        const b = await req.json();
        fullName = b.repo || fullName;
        ref = b.ref || ref;
        token = b.token || token;
      } catch { /* ignore */ }
    }

    if (!fullName || !fullName.includes("/")) {
      return new Response(JSON.stringify({ error: "Missing 'repo' (owner/name)" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Resolve default branch when ref not provided
    if (!ref) {
      const metaResp = await fetch(`https://api.github.com/repos/${fullName}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(token ? { Authorization: `token ${token}` } : {}),
          "User-Agent": "lovable-clone",
        },
      });
      if (metaResp.ok) {
        const meta = await metaResp.json();
        ref = meta.default_branch || "main";
      } else {
        ref = "main";
      }
    }

    const zipUrl = `https://api.github.com/repos/${fullName}/zipball/${ref}`;
    const ghResp = await fetch(zipUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "lovable-clone",
        ...(token ? { Authorization: `token ${token}` } : {}),
      },
      redirect: "follow",
    });

    if (!ghResp.ok || !ghResp.body) {
      const txt = await ghResp.text().catch(() => "");
      console.error(`[github-clone] upstream ${ghResp.status} for ${fullName}@${ref}: ${txt.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ error: `GitHub returned ${ghResp.status}`, detail: txt.slice(0, 300) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    return new Response(ghResp.body, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fullName.split("/")[1]}.zip"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "clone failed" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
