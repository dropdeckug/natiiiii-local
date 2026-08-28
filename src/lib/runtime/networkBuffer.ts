/**
 * Wrap window.fetch and observe Performance resource entries to give the
 * Agent visibility into network activity via the `getNetworkRequests` tool.
 */

export interface NetworkEntry {
  url: string;
  method: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  startedAt: number;
  error?: string;
}

const MAX_ENTRIES = 200;
const buffer: NetworkEntry[] = [];
let installed = false;

function record(entry: NetworkEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function installNetworkBuffer() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  try {
    const origFetch = window.fetch.bind(window);
    const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
      const startedAt = Date.now();
      try {
        const resp = await origFetch(input as any, init);
        record({
          url, method,
          status: resp.status,
          ok: resp.ok,
          durationMs: Date.now() - startedAt,
          startedAt,
        });
        return resp;
      } catch (e: any) {
        record({
          url, method,
          startedAt,
          durationMs: Date.now() - startedAt,
          error: e?.message || String(e),
        });
        throw e;
      }
    };

    try {
      Object.defineProperty(window, "fetch", {
        value: customFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      (window as any).fetch = customFetch;
    }
  } catch (err) {
    console.warn("[networkBuffer] Failed to wrap window.fetch:", err);
  }
}

export function getNetworkRequests(opts: {
  status?: number;
  urlContains?: string;
  errorsOnly?: boolean;
  limit?: number;
} = {}): NetworkEntry[] {
  const limit = opts.limit ?? 50;
  return buffer
    .filter((e) => {
      if (opts.status != null && e.status !== opts.status) return false;
      if (opts.urlContains && !e.url.includes(opts.urlContains)) return false;
      if (opts.errorsOnly && !(e.error || (e.status && e.status >= 400))) return false;
      return true;
    })
    .slice(-limit);
}

export function clearNetworkBuffer() {
  buffer.length = 0;
}
