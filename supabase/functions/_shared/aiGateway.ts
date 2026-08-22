/**
 * AI Gateway router — Google AI Studio first, Lovable AI Gateway as the peer
 * provider and fallback.
 *
 * Every AI route in this project (chat, plugin wiring, android config,
 * project analysis, build repair) goes through `gatewayFetch`.
 *
 * Provider selection:
 *   • `google/*` models are sent to Google AI Studio's OpenAI-compatible
 *     endpoint when `GEMINI_API_KEY` is configured (cheapest path, native
 *     Gemini tool calling). If that call fails transiently, the same request is
 *     retried on the Lovable AI Gateway.
 *   • `openai/*` models always go to the Lovable AI Gateway with
 *     `LOVABLE_API_KEY`.
 *
 * Model ids are vendor-prefixed (`google/…`, `openai/…`). Legacy bare ids are
 * normalized to their gateway equivalents.
 */

export const LOVABLE_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Google AI Studio, OpenAI-compatible surface (bare model ids). */
export const GOOGLE_AI_STUDIO_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Default model — the cheapest Gemini 2.5 tier with solid tool calling. */
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
/** Used when the selected model fails (unavailable / quota). */
export const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";
/** @deprecated retained for callers that still import it. */
export const LEGACY_FALLBACK_MODEL = FALLBACK_MODEL;


/** Every model callers may select. Anything else is normalized away. */
export const SUPPORTED_MODELS = [
  // Google
  "google/gemini-3.6-flash",
  "google/gemini-3.5-flash",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.1-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  // OpenAI
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-luna",
  "openai/gpt-5.5",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-nano",
  "openai/gpt-5.2",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
] as const;

const SUPPORTED = new Set<string>(SUPPORTED_MODELS);

/** Legacy / bare ids mapped onto real gateway model ids. */
const LEGACY_MAP: Record<string, string> = {
  "gemini-3.6-flash": "google/gemini-3.6-flash",
  "gemini-3.5-flash": "google/gemini-3.5-flash",
  "gemini-3.5-flash-lite": "google/gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite": "google/gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview": "google/gemini-3.1-flash-lite",
  "gemini-3-pro-preview": "google/gemini-3.1-pro-preview",
  "gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "gpt-5": "openai/gpt-5",
  "gpt-5-mini": "openai/gpt-5-mini",
  "gpt-5-nano": "openai/gpt-5-nano",
  "gpt-5.2": "openai/gpt-5.2",
  "gpt-5.4": "openai/gpt-5.4",
  "gpt-5.4-mini": "openai/gpt-5.4-mini",
  "gpt-5.4-nano": "openai/gpt-5.4-nano",
  "gpt-5.5": "openai/gpt-5.5",
  "gpt-5.6-sol": "openai/gpt-5.6-sol",
  "gpt-5.6-terra": "openai/gpt-5.6-terra",
  "gpt-5.6-luna": "openai/gpt-5.6-luna",
  // Anthropic ids are not served by this gateway — map to closest equivalent.
  "claude-fable-5": "openai/gpt-5.5",
  "claude-opus-4.5": "openai/gpt-5.5",
  "claude-sonnet-4.5": "openai/gpt-5.4-mini",
  "claude-haiku-4.5": "google/gemini-3.1-flash-lite",
};

export function hasLovableKey(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY"));
}
export function hasGeminiKey(): boolean {
  return Boolean(Deno.env.get("GEMINI_API_KEY"));
}
/** True when Google AI Studio can serve the given model directly. */
export function usesGoogleAiStudio(model: string): boolean {
  return model.startsWith("google/") && hasGeminiKey();
}


/**
 * Accepts any historical model id ("gemini-2.5-pro", "gpt-5",
 * "anthropic/claude-fable-5") and returns a supported gateway model id.
 */
export function normalizeModel(model?: string): string {
  if (!model) return DEFAULT_MODEL;
  const raw = model.trim();
  if (SUPPORTED.has(raw)) return raw;
  const bare = raw.includes("/") ? raw.slice(raw.lastIndexOf("/") + 1) : raw;
  if (LEGACY_MAP[bare]) return LEGACY_MAP[bare];
  if (SUPPORTED.has(`google/${bare}`)) return `google/${bare}`;
  if (SUPPORTED.has(`openai/${bare}`)) return `openai/${bare}`;
  return DEFAULT_MODEL;
}

function buildBody(model: string, payload: Record<string, unknown>) {
  const body: Record<string, unknown> = { model, ...payload };
  const isOpenAI = model.startsWith("openai/");

  // Google models reject OpenAI-only tuning fields.
  if (!isOpenAI) {
    delete body.reasoning_effort;
    delete body.service_tier;
    delete body.verbosity;
  }

  if (isOpenAI) {
    // GPT-5.6 on chat-completions rejects tool calls unless reasoning is off.
    if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";
    if (body.max_tokens && !body.max_completion_tokens) {
      body.max_completion_tokens = body.max_tokens;
    }
    delete body.max_tokens;
    // OpenAI reasoning models only accept the default temperature.
    delete body.temperature;
    delete body.top_p;
  } else {
    if (body.max_completion_tokens && !body.max_tokens) {
      body.max_tokens = body.max_completion_tokens;
    }
    delete body.max_completion_tokens;
  }
  return body;
}

export interface GatewayCallOptions {
  /** Model id; defaults to DEFAULT_MODEL. Legacy ids are normalized. */
  model?: string;
  /** Any OpenAI-compatible chat-completions fields (messages, tools, stream…). */
  payload: Record<string, unknown>;
  /** Force a provider instead of the automatic choice. */
  provider?: "auto" | "google-ai-studio" | "lovable";
}

/**
 * One chat-completions request. `google/*` models are served by Google AI
 * Studio when `GEMINI_API_KEY` exists, everything else by the Lovable AI
 * Gateway. Returns the raw Response so callers can stream or parse. On a
 * transient failure (404/429/5xx) it retries: Google AI Studio → Lovable
 * Gateway → FALLBACK_MODEL.
 */
export async function gatewayFetch(opts: GatewayCallOptions): Promise<Response> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const googleKey = Deno.env.get("GEMINI_API_KEY");
  const model = normalizeModel(opts.model);
  const provider = opts.provider ?? "auto";

  const preferGoogle =
    provider === "google-ai-studio" ||
    (provider === "auto" && model.startsWith("google/") && Boolean(googleKey));

  if (!lovableKey && !googleKey) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured (GEMINI_API_KEY or LOVABLE_API_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const sendGoogle = (m: string) =>
    fetch(GOOGLE_AI_STUDIO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleKey}`,
        "Content-Type": "application/json",
      },
      // Google AI Studio expects bare model ids ("gemini-2.5-flash").
      body: JSON.stringify(buildBody(m.replace(/^google\//, ""), opts.payload)),
    });

  const sendLovable = (m: string) =>
    fetch(LOVABLE_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(m, opts.payload)),
    });

  const transient = (r: Response) =>
    !r.ok && (r.status >= 500 || r.status === 429 || r.status === 404 || r.status === 400);

  if (preferGoogle && googleKey) {
    const resp = await sendGoogle(model);
    if (!transient(resp) || !lovableKey) return resp;
    console.warn(`[ai] Google AI Studio ${model} returned ${resp.status}; retrying on Lovable AI Gateway`);
  }

  if (!lovableKey) {
    // Google-only deployment: last attempt on the cheaper fallback model.
    const resp = await sendGoogle(FALLBACK_MODEL);
    return resp;
  }

  const resp = await sendLovable(model);
  if (!transient(resp) || model === FALLBACK_MODEL) return resp;

  console.warn(`[ai-gateway] ${model} returned ${resp.status}; retrying on ${FALLBACK_MODEL}`);
  return await sendLovable(FALLBACK_MODEL);
}


/** Convenience wrapper returning parsed JSON, throwing on non-OK. */
export async function gatewayJson(opts: GatewayCallOptions): Promise<any> {
  const resp = await gatewayFetch(opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${text.slice(0, 800)}`);
  }
  return await resp.json();
}
