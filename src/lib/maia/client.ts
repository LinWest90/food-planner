import type Anthropic from "@anthropic-ai/sdk";

// Settings shared by every Maia request.
export const MAIA_MODEL = "claude-opus-5-5";

// If a safety check declines a request, the API retries it on another
// model chosen by Anthropic instead of failing.
export const fallbackParams = (): {
  betas: Anthropic.Beta.AnthropicBeta[];
  fallbacks: Anthropic.Beta.BetaFallbacksParam;
} => ({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });

export const MISSING_KEY_ERROR =
  "Maia isn't set up yet: ANTHROPIC_API_KEY is missing from .env.local.";

/**
 * A specific, user-facing message for a failed Claude API call, so problems
 * like an empty credit balance or an overloaded API are clear instead of a
 * generic "something went wrong". Also logs the details for Vercel's logs.
 */
export function describeMaiaError(err: unknown, where: string): string {
  const e = err as { status?: number; message?: string; requestID?: string | null; name?: string };
  console.error(`${where} failed`, { name: e?.name, status: e?.status, requestID: e?.requestID, message: e?.message });
  const detail = (e?.message ?? "").replace(/\s+/g, " ").slice(0, 200);
  switch (e?.status) {
    case 400:
    case 413:
      return `Maia couldn't process this request (${detail}). If it keeps happening, try "Start a new plan".`;
    case 401:
      return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.";
    case 402:
      return "The Anthropic account is out of credit. Add credit at console.anthropic.com → Billing, then try again.";
    case 403:
    case 404:
      return `Anthropic refused the request (${detail}).`;
    case 429:
      return "Maia is busy (rate limited). Wait a minute and try again.";
    case 500:
    case 502:
    case 503:
    case 529:
      return "Anthropic's servers are overloaded or having trouble right now. Wait a minute and try again.";
  }
  if (e?.name === "APIConnectionError" || e?.name === "APIConnectionTimeoutError") {
    return "Couldn't reach Anthropic (connection problem or timeout). Please try again.";
  }
  return `Something went wrong talking to Maia${e?.name ? ` (${e.name})` : ""}. Please try again.`;
}
