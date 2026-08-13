/**
 * Local, no-AI message generation for Campaigns.
 *
 * Everything here is pure data + string assembly — no network, no API keys, no
 * external model. The generator combines hand-written phrase banks (greeting →
 * hook → offer → call-to-action) into varied, natural-sounding messages, and a
 * seeded RNG lets "Generate more" produce fresh combinations every click.
 *
 * Messages use ONLY the placeholders the server actually fills on send
 * ([First Name], [Customer Name], [Business Name]) — see segments.ts — so what
 * you preview is exactly what your customers receive.
 */
import type { SegmentKey } from "./segments";

// ---------------------------------------------------------------- variables

/** Personalization tokens, surfaced as clickable chips in the editor. */
export const VARIABLES: { token: string; label: string; sample: string }[] = [
  { token: "[First Name]", label: "First name", sample: "John" },
  { token: "[Customer Name]", label: "Full name", sample: "John Smith" },
  { token: "[Business Name]", label: "Business", sample: "your shop" },
];

// ---------------------------------------------------------------- purpose

export type Purpose =
  | "win_back" | "new_customer" | "returning_reminder" | "seasonal"
  | "appointment_reminder" | "follow_up" | "review_request"
  | "maintenance_reminder" | "birthday" | "general_promo";

type PurposeDef = {
  key: Purpose;
  label: string;
  /** The audience this goal usually targets (pre-selects the segment). */
  segment: SegmentKey;
  /** A sensible default email subject. */
  subject: string;
  hooks: string[];
  /** Shorter hooks used when the tone is "short & direct". */
  short?: string[];
  /** Purpose-specific call-to-action (overrides the tone's default CTA). */
  ctas?: string[];
};

export const PURPOSES: PurposeDef[] = [
  {
    key: "win_back", label: "Win-back campaign", segment: "lapsed_90", subject: "We miss your car",
    hooks: [
      "It's been a while since your last detail, and your car deserves that fresh-off-the-lot feeling again.",
      "We noticed it's been a bit since we last saw your vehicle — let's fix that.",
      "Your ride is probably due for some TLC since your last visit with [Business Name].",
      "We'd love to get your vehicle looking its absolute best again.",
    ],
    short: ["Your car's overdue for a detail.", "It's been a while — let's get your car fresh again."],
  },
  {
    key: "new_customer", label: "New customer promotion", segment: "new_30", subject: "Welcome to [Business Name]",
    hooks: [
      "Welcome to [Business Name]! We'd love to get your vehicle looking its absolute best.",
      "Thanks for choosing [Business Name] — your first detail with us is going to turn heads.",
      "We're excited to help keep your car looking showroom-clean.",
    ],
    short: ["Welcome to [Business Name]!", "Ready for your first detail with us?"],
  },
  {
    key: "returning_reminder", label: "Returning customer reminder", segment: "repeat", subject: "Time for your next detail",
    hooks: [
      "It's the perfect time to keep your car looking its best.",
      "Your vehicle is due for its next detail to stay in top shape.",
      "Keep that shine going — your car's ready for another refresh.",
    ],
    short: ["Time for your next detail.", "Your car's due for a refresh."],
  },
  {
    key: "seasonal", label: "Seasonal promotion", segment: "all", subject: "A seasonal detail for your car",
    hooks: [
      "Seasons change, and so do your car's needs — let's get it prepped.",
      "Protect your vehicle from the season ahead with a fresh detail.",
      "Now's the ideal time to get your car season-ready.",
    ],
    short: ["Get your car season-ready.", "Time to prep your car for the season."],
  },
  {
    key: "appointment_reminder", label: "Appointment reminder", segment: "all", subject: "Your upcoming detail",
    hooks: [
      "This is a friendly reminder about your upcoming detail with [Business Name].",
      "Just a quick reminder that your appointment with us is coming up.",
    ],
    short: ["Reminder: your detail is coming up.", "Your appointment with [Business Name] is soon."],
    ctas: ["Reply if you need to reschedule.", "See you soon — reply with any questions.", "Let us know if anything changes."],
  },
  {
    key: "follow_up", label: "Follow-up", segment: "all", subject: "How's your car looking?",
    hooks: [
      "We hope your vehicle is still looking great after your last detail!",
      "Just checking in after your recent visit with [Business Name].",
      "Thanks again for trusting us with your car.",
    ],
    short: ["Hope your car still looks great!", "Thanks again for visiting [Business Name]."],
    ctas: ["Ready for the next one? Just reply to book.", "We'd love to see you again — book anytime.", "Let us know when you'd like your next detail."],
  },
  {
    key: "review_request", label: "Review request", segment: "repeat", subject: "How did we do?",
    hooks: [
      "We hope you loved the results of your recent detail!",
      "Your feedback helps [Business Name] grow — we'd love to hear how we did.",
      "If your car's still turning heads, we'd be grateful for a moment of your time.",
    ],
    short: ["Mind leaving [Business Name] a quick review?", "How did we do? A quick review helps a ton."],
    ctas: ["Would you leave us a quick review? It means the world.", "Tap here to share a quick review — thank you!", "A quick review would truly make our day."],
  },
  {
    key: "maintenance_reminder", label: "Maintenance reminder", segment: "repeat", subject: "Keep your car in top shape",
    hooks: [
      "Regular detailing keeps your paint protected and your ride looking sharp.",
      "It's about time for your maintenance detail to keep things pristine.",
      "Keep your vehicle in top condition with a routine detail.",
    ],
    short: ["Time for your maintenance detail.", "Keep your car protected — book a maintenance detail."],
  },
  {
    key: "birthday", label: "Birthday message", segment: "all", subject: "A birthday treat for your car",
    hooks: [
      "Happy birthday from all of us at [Business Name]!",
      "It's your birthday — treat your car to something special, on us.",
    ],
    short: ["Happy birthday from [Business Name]!", "It's your birthday — treat your car!"],
    ctas: ["Book this month to celebrate!", "Come celebrate with a fresh detail!", "Treat yourself — book today!"],
  },
  {
    key: "general_promo", label: "General promotion", segment: "all", subject: "A little something from [Business Name]",
    hooks: [
      "We've got something special going on at [Business Name] this week.",
      "Now's a great time to treat your car to a professional detail.",
      "Your car works hard — give it the shine it deserves.",
    ],
    short: ["Treat your car to a detail this week.", "Something special is happening at [Business Name]."],
  },
];

const PURPOSE_MAP = Object.fromEntries(PURPOSES.map((p) => [p.key, p])) as Record<Purpose, PurposeDef>;

// ---------------------------------------------------------------- tone

export type Tone = "professional" | "friendly" | "casual" | "short" | "promotional";

type ToneDef = { key: Tone; label: string; greetings: string[]; ctas: string[] };

export const TONES: ToneDef[] = [
  {
    key: "professional", label: "Professional",
    greetings: ["Hi [First Name],", "Hello [First Name],", "Hi [First Name] —"],
    ctas: ["Reply or call us to book your appointment.", "Book your appointment whenever it's convenient.", "Let us know a time that suits you and we'll get you scheduled."],
  },
  {
    key: "friendly", label: "Friendly",
    greetings: ["Hey [First Name]! 👋", "Hi [First Name]! 😊", "Hi there, [First Name]!"],
    ctas: ["We'd love to see you — book your spot today!", "Ready when you are — just reply to book!", "Let's get your car shining again — book today!"],
  },
  {
    key: "casual", label: "Casual",
    greetings: ["Hey [First Name]!", "Hey [First Name] 👋", "What's up, [First Name]!"],
    ctas: ["Hit us up to grab a slot!", "Reply and we'll get you booked!", "Let's get you on the schedule!"],
  },
  {
    key: "short", label: "Short & direct",
    greetings: ["Hi [First Name] —", "[First Name],", "Hey [First Name],"],
    ctas: ["Book today.", "Reply to book.", "Reserve your spot now."],
  },
  {
    key: "promotional", label: "Promotional",
    greetings: ["Hey [First Name]! 🚗", "[First Name], good news!", "Hi [First Name]! ✨"],
    ctas: ["Book now before it's gone!", "Grab your spot today!", "Don't miss out — book now!"],
  },
];

const TONE_MAP = Object.fromEntries(TONES.map((t) => [t.key, t])) as Record<Tone, ToneDef>;

// ---------------------------------------------------------------- offer

export type OfferKind = "none" | "percent" | "dollar" | "custom";

export const OFFERS: { key: OfferKind; label: string }[] = [
  { key: "none", label: "No offer" },
  { key: "percent", label: "Percentage off" },
  { key: "dollar", label: "Dollar amount off" },
  { key: "custom", label: "Custom offer" },
];

const MONEY_CLAUSES = [
  "Enjoy {offer} your next detail.",
  "Right now, take {offer} any service.",
  "As a thank-you, here's {offer} your next visit.",
  "For a limited time, get {offer} when you book.",
];
const CUSTOM_CLAUSES = [
  "Plus, enjoy {offer} on your next visit.",
  "As a bonus: {offer}.",
  "And {offer} to sweeten the deal.",
];

function offerText(offer: OfferKind, value?: string): string | null {
  const v = (value ?? "").trim();
  if (offer === "percent") return v ? `${v.replace(/[^0-9.]/g, "")}% off` : null;
  if (offer === "dollar") return v ? `$${v.replace(/[^0-9.]/g, "")} off` : null;
  if (offer === "custom") return v || null;
  return null;
}

// ---------------------------------------------------------------- generator

export type GenOptions = { purpose: Purpose; tone: Tone; offer: OfferKind; offerValue?: string };

/** Small deterministic PRNG so the same seed reproduces the same set. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build `count` distinct message variations from the phrase banks. Bump `seed`
 * (e.g. on "Generate more") for a fresh, non-repeating set.
 */
export function generateVariations(opts: GenOptions, count = 3, seed = 1): string[] {
  const rng = mulberry32((seed >>> 0) || 1);
  const purpose = PURPOSE_MAP[opts.purpose] ?? PURPOSE_MAP.general_promo;
  const tone = TONE_MAP[opts.tone] ?? TONE_MAP.friendly;
  const isShort = opts.tone === "short";
  const hooks = isShort ? purpose.short ?? purpose.hooks : purpose.hooks;
  const ctas = purpose.ctas ?? tone.ctas;
  const oText = offerText(opts.offer, opts.offerValue);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const out = new Set<string>();
  let tries = 0;
  const maxOut = Math.min(count, Math.max(3, hooks.length * 2));
  while (out.size < maxOut && tries < maxOut * 12) {
    tries++;
    const g = pick(tone.greetings);
    const h = pick(hooks);
    const c = pick(ctas);
    let offerClause = "";
    if (oText) {
      const pool = opts.offer === "custom" ? CUSTOM_CLAUSES : MONEY_CLAUSES;
      offerClause = pick(pool).replace("{offer}", oText);
    }
    const msg = [g, h, offerClause, c].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
    out.add(msg);
  }
  return [...out];
}

// ---------------------------------------------------------------- templates

export type StarterTemplate = {
  id: string;
  name: string;
  channel: "email" | "sms";
  segment: SegmentKey;
  subject: string;
  message: string;
};

/** Ready-to-use starting points. Every message uses only server-rendered tokens. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "we-miss-you", name: "We Miss You", channel: "email", segment: "lapsed_90",
    subject: "We miss your car",
    message: "Hi [First Name],\n\nIt's been a while since your last visit to [Business Name], and we'd love to get your car looking its best again. Whenever you're ready, we're here to help it shine.\n\nReply to this email or give us a call to book.\n\n— The team at [Business Name]",
  },
  {
    id: "next-detail", name: "Time for Your Next Detail", channel: "sms", segment: "repeat",
    subject: "Time for your next detail",
    message: "Hi [First Name]! Your car is due for its next detail at [Business Name]. Reply to book a time that works for you.",
  },
  {
    id: "seasonal-special", name: "Seasonal Special", channel: "email", segment: "all",
    subject: "A seasonal detail for your car",
    message: "Hi [First Name],\n\nThe season's changing — the perfect time to protect your vehicle and keep it looking sharp. Book a seasonal detail with [Business Name] and we'll handle the rest.\n\nReply anytime to grab a spot.",
  },
  {
    id: "new-customer-offer", name: "New Customer Offer", channel: "email", segment: "new_30",
    subject: "Welcome to [Business Name]",
    message: "Hi [First Name],\n\nWelcome to [Business Name]! We'd love to get your vehicle looking its absolute best. As a new customer, enjoy a little something extra on your first detail.\n\nReply to book whenever you're ready.",
  },
  {
    id: "appointment-reminder", name: "Appointment Reminder", channel: "sms", segment: "all",
    subject: "Your upcoming detail",
    message: "Hi [First Name], a friendly reminder about your upcoming detail with [Business Name]. Reply if you need to reschedule — see you soon!",
  },
  {
    id: "review-request", name: "Review Request", channel: "sms", segment: "repeat",
    subject: "How did we do?",
    message: "Hi [First Name]! We hope you loved your recent detail at [Business Name]. Would you leave us a quick review? It truly makes our day. Thank you!",
  },
  {
    id: "maintenance-reminder", name: "Maintenance Reminder", channel: "email", segment: "repeat",
    subject: "Keep your car in top shape",
    message: "Hi [First Name],\n\nRegular detailing keeps your paint protected and your ride looking its best. It's about time for your maintenance detail with [Business Name] — reply and we'll get you scheduled.",
  },
  {
    id: "weekend-special", name: "Weekend Special", channel: "sms", segment: "all",
    subject: "This weekend only",
    message: "Hey [First Name]! This weekend only, treat your car to a fresh detail at [Business Name]. Spots go fast — reply to grab yours!",
  },
  {
    id: "holiday-promotion", name: "Holiday Promotion", channel: "email", segment: "all",
    subject: "A holiday treat for your car",
    message: "Hi [First Name],\n\nThe holidays are here! Give your car (or someone else's) the gift of a professional detail from [Business Name]. Reply to book or ask about gift options.\n\nHappy holidays from all of us!",
  },
];
