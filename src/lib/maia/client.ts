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
