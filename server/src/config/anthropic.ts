import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

/**
 * Anthropic client — lazy and optional, same shape as stripeClient().
 *
 * Without ANTHROPIC_API_KEY this returns null and the Gear Assistant route
 * reports "not configured" instead of throwing, so the app runs fully with no
 * AI account. The key is server-only and never reaches the browser — the client
 * asks our API, our API asks Claude.
 */
let _client: Anthropic | null | undefined;

export function anthropicClient(): Anthropic | null {
  if (_client !== undefined) return _client;
  _client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  return _client;
}

/** The model the Gear Assistant runs on. Opus 4.8 — strong reasoning for advice. */
export const GEAR_ASSISTANT_MODEL = "claude-opus-4-8";
