import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const JUPITER_BASE = "https://lite-api.jup.ag";
const RAPTOR_BASE = "https://raptor-beta.solanatracker.io";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const RETRY_DELAYS_MS = [350, 1000, 2500];

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function retryAfterMs(response: Response, fallback: number): number {
  const raw = response.headers.get("retry-after");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 250), 10_000);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 250), 10_000);
  return fallback;
}

async function fetchJupiterQuote(url: string): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OrbitX/1.0" },
    });
    lastResponse = response;
    if (response.ok || (response.status !== 429 && response.status < 500)) {
      return response;
    }
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterMs(response, RETRY_DELAYS_MS[attempt] ?? 1000)),
      );
    }
  }
  return lastResponse ?? new Response("Jupiter request failed", { status: 502 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    const inputMint = typeof body.inputMint === "string" ? body.inputMint.trim() : "";
    const outputMint = typeof body.outputMint === "string" ? body.outputMint.trim() : "";
    const amount = typeof body.amount === "string" || typeof body.amount === "number" ? String(body.amount) : "";
    const slippageBps = typeof body.slippageBps === "number" ? body.slippageBps : 50;

    if (!inputMint || !outputMint || !/^\d+$/.test(amount) || Number(amount) <= 0) {
      return json({ success: false, error: "inputMint, outputMint, and a positive raw amount are required" }, 400);
    }

    const quoteUrl = new URL(`${JUPITER_BASE}/swap/v1/quote`);
    quoteUrl.searchParams.set("inputMint", inputMint);
    quoteUrl.searchParams.set("outputMint", outputMint);
    quoteUrl.searchParams.set("amount", amount);
    quoteUrl.searchParams.set("slippageBps", String(Math.max(1, Math.min(slippageBps, 5000))));

    const quoteResponse = await fetchJupiterQuote(quoteUrl.toString());
    const text = await quoteResponse.text();
    let upstream: unknown;
    try { upstream = JSON.parse(text); } catch { upstream = null; }

    if (quoteResponse.ok) {
      return json({ success: true, quote: { ...(upstream as Record<string, unknown>), provider: "jupiter" }, timestamp: new Date().toISOString() });
    }

    if (quoteResponse.status === 429 || quoteResponse.status >= 500) {
      const raptorUrl = new URL(`${RAPTOR_BASE}/quote`);
      raptorUrl.searchParams.set("inputMint", inputMint);
      raptorUrl.searchParams.set("outputMint", outputMint);
      raptorUrl.searchParams.set("amount", amount);
      raptorUrl.searchParams.set("slippageBps", String(Math.max(1, Math.min(slippageBps, 5000))));
      const raptorResponse = await fetch(raptorUrl.toString(), { headers: { Accept: "application/json" } });
      const raptor = await raptorResponse.json() as Record<string, unknown>;
      const amountIn = String(raptor.amountIn ?? raptor.inAmount ?? "");
      const amountOut = String(raptor.amountOut ?? raptor.outAmount ?? "");
      if (raptorResponse.ok && amountIn && amountOut) {
        return json({
          success: true,
          provider: "raptor",
          quote: {
            inputMint,
            outputMint,
            inAmount: amountIn,
            outAmount: amountOut,
            otherAmountThreshold: String(raptor.minAmountOut ?? amountOut),
            minAmountOut: String(raptor.minAmountOut ?? amountOut),
            slippageBps,
            routePlan: Array.isArray(raptor.routePlan) ? raptor.routePlan : [],
            provider: "raptor",
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (quoteResponse.status === 429) {
      const retryAfter = quoteResponse.headers.get("retry-after") ?? "3";
      return json(
        {
          success: false,
          error: "Jupiter and Raptor are temporarily rate limiting quote requests. Please retry shortly.",
          retryAfterSeconds: Number(retryAfter) || 3,
        },
        429,
        { "Retry-After": retryAfter },
      );
    }
    const upstreamError = upstream && typeof upstream === "object" && "error" in upstream
      ? String((upstream as { error: unknown }).error)
      : `Jupiter API error: ${quoteResponse.status}`;
    return json({ success: false, error: upstreamError }, 502);
  } catch (error) {
    return json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});
