import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropicClient, GEAR_ASSISTANT_MODEL } from "../config/anthropic";
import { ApiError } from "../utils/ApiError";

export interface AssistantContext {
  experience?: string;
  budget?: string;
  goal?: string;
  currentEquipment?: string;
}

export interface AssistantAnswer {
  recommendation: string;
  explanation: string;
  pros: string[];
  cons: string[];
  alternatives: { name: string; note: string }[];
  learn: string;
}

/**
 * JSON Schema the model must fill. All fields required (structured-outputs rule),
 * but arrays may be empty — a pure "teach me" question leaves pros/cons/
 * alternatives empty and carries the answer in explanation + learn.
 */
const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendation: { type: "string", description: "The headline answer — what to do or buy, in one or two sentences." },
    explanation: { type: "string", description: "Why, in plain language: the reasoning tailored to this detailer's situation." },
    pros: { type: "array", items: { type: "string" }, description: "Upsides of the recommendation. Empty for pure-education questions." },
    cons: { type: "array", items: { type: "string" }, description: "Honest tradeoffs or downsides. Empty for pure-education questions." },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "The alternative option or product." },
          note: { type: "string", description: "One line on when it's the better pick." },
        },
        required: ["name", "note"],
      },
      description: "Other options worth considering. Empty if none apply.",
    },
    learn: { type: "string", description: "A short teaching note that helps the detailer make this kind of decision themselves next time." },
  },
  required: ["recommendation", "explanation", "pros", "cons", "alternatives", "learn"],
} as const;

const SYSTEM_PROMPT = `You are the Detailer Gear Assistant inside Detail Support, an app for professional and aspiring auto detailers. You help detailers make confident equipment, product, and business-setup decisions.

Who you're talking to: working detailers and people starting out. Be practical, specific, and encouraging. Assume they want to make money detailing cars, not collect gear.

How to answer:
- Recommend real, widely available detailing products and tools by name when it helps (pressure washers, foam cannons, extractors, steamers, dual-action polishers, pads, compounds, generators, water tanks, etc.).
- Prices you mention are approximate street prices for guidance only — say "around $X" and never imply live or exact pricing. You are not sponsored by any brand; never imply otherwise.
- Tailor the answer to the detailer's stated experience, budget, current equipment, services offered, and goals. If budget is tight, respect it and say what's realistically achievable; don't push gear they can't afford or don't need yet.
- Be honest about tradeoffs. A cheaper tool that's genuinely fine is better advice than an expensive one they don't need.
- When they ask to compare two things (e.g. "extractor or steamer first?"), pick one, say why for their situation, and note when the other wins.
- Always include a short teaching note so they get better at these decisions themselves.

If a question isn't about detailing gear or running a detailing business, gently steer back — put a brief redirect in "recommendation" and leave the other fields light.

Answer only via the required structured fields. Keep each field tight and readable; no marketing fluff.`;

function buildUserMessage(question: string, ctx: AssistantContext, servicesText: string): string {
  const lines: string[] = [];
  lines.push(`Detailer's question: ${question}`);
  lines.push("");
  lines.push("What we know about this detailer:");
  lines.push(`- Experience level: ${ctx.experience?.trim() || "not specified"}`);
  lines.push(`- Budget: ${ctx.budget?.trim() || "not specified"}`);
  lines.push(`- Main goal: ${ctx.goal?.trim() || "not specified"}`);
  lines.push(`- Current equipment they mentioned: ${ctx.currentEquipment?.trim() || "not specified"}`);
  lines.push(`- Services they currently offer: ${servicesText}`);
  return lines.join("\n");
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

/**
 * Ask the assistant. Single Claude call with a structured-output schema, grounded
 * in the detailer's real context (their services are read through the caller's
 * RLS-scoped client, so this only ever sees their own org).
 */
export async function askGearAssistant(
  db: SupabaseClient,
  orgId: string,
  question: string,
  ctx: AssistantContext
): Promise<AssistantAnswer> {
  const client = anthropicClient();
  if (!client) {
    throw new ApiError(503, "The AI assistant isn't set up on this server yet.");
  }

  // Live personalization: what services this shop already offers (RLS-scoped).
  const { data: services } = await db
    .from("services")
    .select("name, price")
    .eq("org_id", orgId)
    .eq("active", true)
    .limit(50);
  const servicesText =
    (services ?? [])
      .map((s) => {
        const row = s as { name: string; price: number | null };
        return row.price ? `${row.name} (~$${row.price})` : row.name;
      })
      .join(", ") || "none recorded yet";

  let response;
  try {
    response = await client.messages.create({
      model: GEAR_ASSISTANT_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      messages: [{ role: "user", content: buildUserMessage(question, ctx, servicesText) }],
    });
  } catch (err) {
    // Surface a clean 502 rather than leaking SDK internals; log the real cause.
    console.error("Gear Assistant call failed:", err);
    throw new ApiError(502, "The assistant is having trouble right now. Please try again.");
  }

  if (response.stop_reason === "refusal") {
    throw new ApiError(422, "The assistant couldn't help with that request. Try rephrasing around detailing gear.");
  }

  const text = response.content.find((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")?.text;
  if (!text) throw new ApiError(502, "The assistant returned an empty response. Please try again.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(502, "The assistant returned an unreadable response. Please try again.");
  }

  return {
    recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    pros: asStringArray(parsed.pros),
    cons: asStringArray(parsed.cons),
    alternatives: Array.isArray(parsed.alternatives)
      ? parsed.alternatives
          .map((a) => a as { name?: unknown; note?: unknown })
          .filter((a) => typeof a.name === "string" && a.name.trim().length > 0)
          .map((a) => ({ name: String(a.name), note: typeof a.note === "string" ? a.note : "" }))
      : [],
    learn: typeof parsed.learn === "string" ? parsed.learn : "",
  };
}

/** GET /api/gear/status — is the assistant usable. */
export function assistantStatus() {
  return { configured: Boolean(anthropicClient()) };
}
