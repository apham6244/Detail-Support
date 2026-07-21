import { useMemo, useState } from "react";
import {
  Sparkles, Check, X, ArrowRight, RotateCcw, TriangleAlert, Trophy, Medal,
  Wallet, GraduationCap, Target, Bot, Send, Loader2, Lightbulb, ThumbsUp, ThumbsDown,
  Hammer, Briefcase, PackageCheck, TrendingUp, ChevronRight,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/data";
import { DetailImage } from "@/components/ui/DetailImage";
import { PHOTO, unsplash } from "@/lib/imagery";
import { cn } from "@/lib/cn";
import { useGearAssistant, type AssistantContext, type AssistantAnswer } from "@/hooks/useGearAssistant";
import { useGearLocker } from "@/hooks/useGearLocker";
import { ProductModal, ProductThumb, Stars } from "@/components/gear/GearUI";
import {
  EXPERIENCE_OPTIONS, BUDGET_OPTIONS, BUSINESS_OPTIONS, PRIORITY_OPTIONS, STAGES,
  buildSetup, pickTrio, assessBudget, useCaseOf, PRICE_DISCLAIMER,
  type Experience, type BudgetTier, type BusinessType, type Priority, type Goal,
  type RecoContext, type Stage, type Product,
} from "@/lib/gearCatalog";

type Tab = "build" | "assistant";

const money = (n: number) => `$${n.toLocaleString()}`;

const GOAL_FROM_BUSINESS: Record<BusinessType, Goal> = {
  hobby: "improve_quality",
  mobile: "start_mobile",
  shop: "more_services",
};
const STAGE_FROM_EXP: Record<Experience, Stage["key"]> = {
  beginner: "starter",
  intermediate: "growing",
  professional: "professional",
};

export default function GearGuide() {
  const [tab, setTab] = useState<Tab>("build");

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <div className="relative mb-6 min-h-[200px] overflow-hidden rounded-2xl shadow-hero-dark sm:min-h-[210px]">
        <DetailImage src={unsplash(PHOTO.detailerGarage, { w: 1600, q: 60 })} alt="Professional detailer working on a vehicle" className="absolute inset-0" eager />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/85 to-carbon-950/25" />
        <div className="absolute inset-0 bg-paint-gloss opacity-70" />
        <div className="relative px-5 py-7 sm:px-9 sm:py-9">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.15em] text-brand-300">Detailer Gear Guide</div>
          <h1 className="font-display mt-2 max-w-xl text-[26px] font-extrabold leading-[1.08] text-white sm:text-[32px]">
            The gear that grows with your business.
          </h1>
          <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-white/70">
            Get matched to the right tools and products, compare your options, and build a complete setup around your
            budget, experience, and goals.
          </p>
        </div>
      </div>

      <Tabs tab={tab} setTab={setTab} />

      {tab === "build" && <div className="mx-auto max-w-4xl"><Build /></div>}
      {tab === "assistant" && <div className="mx-auto max-w-4xl"><Assistant /></div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const item = (key: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition",
        tab === key ? "bg-brand-500 text-white shadow-glow" : "text-ink2 hover:bg-line2"
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="mb-[18px] inline-flex flex-wrap gap-1 rounded-xl border border-line bg-panel2/50 p-1">
      {item("build", <Hammer className="h-4 w-4" />, "Build a Setup")}
      {item("assistant", <Bot className="h-4 w-4" />, "Ask the AI")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build a Setup
// ---------------------------------------------------------------------------

function Build() {
  const locker = useGearLocker();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [business, setBusiness] = useState<BusinessType | null>(null);
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [priority, setPriority] = useState<Priority | null>("value");
  const [submitted, setSubmitted] = useState(false);

  const customValue = Number(customBudget);
  const customValid = budgetTier === "custom" ? Number.isFinite(customValue) && customValue >= 1 : true;
  const ready = Boolean(experience && business && budgetTier && priority && customValid);

  const budgetTotal = useMemo(() => {
    if (!budgetTier) return 0;
    if (budgetTier === "custom") return Math.max(1, Math.round(customValue));
    return BUDGET_OPTIONS.find((b) => b.key === budgetTier)?.ceiling ?? 0;
  }, [budgetTier, customValue]);

  const budgetLabel = budgetTier === "custom"
    ? `Up to ${money(budgetTotal)}`
    : BUDGET_OPTIONS.find((b) => b.key === budgetTier)?.label ?? "";

  const submit = () => {
    setSubmitted(true);
    if (experience && business) {
      locker.saveProfile({ experience, business, goal: GOAL_FROM_BUSINESS[business], budgetCeiling: budgetTotal });
    }
  };

  if (submitted && experience && business && priority) {
    return (
      <BuildResults
        experience={experience}
        business={business}
        priority={priority}
        budgetTotal={budgetTotal}
        summary={{
          experience: EXPERIENCE_OPTIONS.find((e) => e.key === experience)!.label,
          business: BUSINESS_OPTIONS.find((b) => b.key === business)!.label,
          budget: budgetLabel,
          priority: PRIORITY_OPTIONS.find((p) => p.key === priority)!.label,
        }}
        onAdjust={() => setSubmitted(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Card>
        <CardBody className="flex flex-col gap-6">
          <Question icon={<GraduationCap className="h-4 w-4" />} step={1} title="What's your experience level?">
            <div className="grid gap-2.5 sm:grid-cols-3">
              {EXPERIENCE_OPTIONS.map((o) => (
                <Choice key={o.key} selected={experience === o.key} onClick={() => setExperience(o.key)} title={o.label} blurb={o.blurb} />
              ))}
            </div>
          </Question>

          <Question icon={<Briefcase className="h-4 w-4" />} step={2} title="What kind of detailing?">
            <div className="grid gap-2.5 sm:grid-cols-3">
              {BUSINESS_OPTIONS.map((o) => (
                <Choice key={o.key} selected={business === o.key} onClick={() => setBusiness(o.key)} title={o.label} blurb={o.blurb} />
              ))}
            </div>
          </Question>

          <Question icon={<Wallet className="h-4 w-4" />} step={3} title="What's your total budget?">
            <div className="grid gap-2.5 sm:grid-cols-3">
              {BUDGET_OPTIONS.map((o) => (
                <Choice key={o.key} selected={budgetTier === o.key} onClick={() => setBudgetTier(o.key)} title={o.label} />
              ))}
            </div>
            {budgetTier === "custom" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[12px] font-medium text-ink2">Your total budget</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink3">$</span>
                    <input
                      type="number" min={1} inputMode="numeric" value={customBudget}
                      onChange={(e) => setCustomBudget(e.target.value)} placeholder="500"
                      className={cn("h-10 w-40 rounded-lg border bg-panel pl-7 pr-3 text-[14px] text-ink outline-none transition focus:border-brand-500", customValid ? "border-line" : "border-danger")}
                    />
                  </div>
                  {!customValid && <span className="text-[12px] font-medium text-danger">Enter an amount of $1 or more.</span>}
                </div>
              </div>
            )}
          </Question>

          <Question icon={<Target className="h-4 w-4" />} step={4} title="What matters most?">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PRIORITY_OPTIONS.map((o) => (
                <Choice key={o.key} selected={priority === o.key} onClick={() => setPriority(o.key)} title={o.label} blurb={o.blurb} />
              ))}
            </div>
          </Question>
        </CardBody>
      </Card>

      <button
        onClick={submit}
        disabled={!ready}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 text-[14px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" /> Build my setup <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function BuildResults({ experience, business, priority, budgetTotal, summary, onAdjust }: {
  experience: Experience;
  business: BusinessType;
  priority: Priority;
  budgetTotal: number;
  summary: { experience: string; business: string; budget: string; priority: string };
  onAdjust: () => void;
}) {
  const [stageKey, setStageKey] = useState<Stage["key"]>(STAGE_FROM_EXP[experience]);
  const [active, setActive] = useState<Product | null>(null);

  const ctx: RecoContext = { experience, goal: GOAL_FROM_BUSINESS[business], budgetCeiling: budgetTotal, business };
  const kit = useMemo(() => buildSetup(stageKey, budgetTotal, ctx, priority), [stageKey, budgetTotal, experience, business, priority]);
  const stage = STAGES.find((s) => s.key === stageKey)!;

  const idealByStage = useMemo(
    () => STAGES.map((s) => ({ stage: s, kit: buildSetup(s.key, Number.MAX_SAFE_INTEGER, ctx, priority) })),
    [experience, business, priority]
  );

  const reality = assessBudget(ctx.goal, budgetTotal);
  const topSubs = stage.subs.slice(0, 6);

  const openProduct = (p: Product) => setActive(p);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel2/50 px-4 py-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink3">Your setup</span>
        <Chip>{summary.experience}</Chip>
        <Chip>{summary.business}</Chip>
        <Chip>{summary.budget}</Chip>
        <Chip>{summary.priority}</Chip>
        <button onClick={onAdjust} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3">
          <RotateCcw className="h-3.5 w-3.5" /> Adjust
        </button>
      </div>

      {/* Complete setup kit */}
      <KitCard kit={kit} stage={stage} onOpen={openProduct} />

      {/* Budget reality */}
      {!reality.realistic && (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.08] px-4 py-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-warning">
            <TriangleAlert className="h-4 w-4 flex-none" /> Heads up on your budget
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
            A complete {stage.label.toLowerCase()} kit runs about <span className="font-semibold text-ink">{money(kit.fullTotal)}</span>.
            {" "}At {money(budgetTotal)} you'll cover {kit.covered} of {kit.items.length} essentials — build the rest in as cash flow allows.
          </p>
        </div>
      )}

      {/* Progression path */}
      <div>
        <SectionHead icon={TrendingUp} title="Your progression path" subtitle="Starter → Growing → Professional" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {idealByStage.map(({ stage: s, kit: k }) => (
            <button
              key={s.key}
              onClick={() => setStageKey(s.key)}
              className={cn(
                "surface gloss-card flex flex-col rounded-2xl p-4 text-left transition hover:shadow-lift",
                s.key === stageKey ? "border-brand-500/50 ring-1 ring-brand-500/30" : "hover:border-brand-500/30"
              )}
            >
              <div className="flex items-center gap-2">
                <PackageCheck className={cn("h-4 w-4", s.key === stageKey ? "text-brand-500" : "text-ink3")} />
                <span className="font-display text-[14px] font-bold text-ink">{s.label}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink3">{s.blurb}</p>
              <div className="mt-3 flex items-end justify-between border-t border-line2 pt-2.5">
                <div>
                  <div className="font-display text-[17px] font-bold tnum text-ink">{money(k.fullTotal)}</div>
                  <div className="text-[10.5px] text-ink3">{k.items.length} essentials</div>
                </div>
                {s.key === stageKey && <span className="rounded-full bg-brand-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-500">You</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Best / Alternative / Premium by category */}
      <div>
        <SectionHead icon={Trophy} title="Top picks by category" subtitle="Best choice, a cheaper alternative, and a premium option" />
        <div className="mt-3 flex flex-col gap-5">
          {topSubs.map((sub) => {
            const trio = pickTrio(sub, ctx, priority);
            return (
              <div key={sub}>
                <h4 className="mb-2 text-[13.5px] font-bold tracking-tight text-ink">{kitLabel(kit, sub)}</h4>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <TrioPick rank="best" product={trio.best} budget={budgetTotal} onOpen={openProduct} />
                  {trio.alternative && <TrioPick rank="alt" product={trio.alternative} budget={budgetTotal} onOpen={openProduct} />}
                  {trio.premium && trio.premium.id !== trio.best.id && <TrioPick rank="premium" product={trio.premium} budget={budgetTotal} onOpen={openProduct} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="pb-2 text-center text-[11.5px] text-ink3">{PRICE_DISCLAIMER}</p>

      {active && <ProductModal product={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function kitLabel(kit: ReturnType<typeof buildSetup>, sub: string): string {
  return kit.items.find((i) => i.sub === sub)?.label ?? sub;
}

function KitCard({ kit, stage, onOpen }: {
  kit: ReturnType<typeof buildSetup>;
  stage: Stage;
  onOpen: (p: Product) => void;
}) {
  const pct = kit.budget > 0 ? Math.min(100, Math.round((kit.total / kit.budget) * 100)) : 0;
  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-line p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[17px] font-bold tracking-tight text-ink">Your complete {stage.label.toLowerCase()} setup</div>
            <div className="text-[12px] text-ink3">{kit.covered} of {kit.items.length} essentials within your budget</div>
          </div>
          <div className="text-right">
            <div className="font-display text-[22px] font-bold leading-none tnum text-ink">{money(kit.total)}</div>
            <div className="mt-1 text-[11px] text-ink3">of {money(kit.budget)} budget</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line2">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="divide-y divide-line2">
        {kit.items.map((item) => {
          return (
            <button
              key={item.sub}
              onClick={() => onOpen(item.product)}
              className={cn("group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-panel2/60", !item.included && "opacity-60")}
            >
              <ProductThumb product={item.product} className="h-11 w-11 flex-none" iconClass="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">{item.label}</div>
                <div className="truncate text-[13.5px] font-semibold text-ink">{item.product.name}</div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                {item.included ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <span className="rounded-full bg-warning/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">Upgrade next</span>
                )}
                <span className="font-display text-[14px] font-bold tnum text-ink">{money(item.product.price)}</span>
                <ChevronRight className="h-4 w-4 text-ink3 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </div>
            </button>
          );
        })}
      </div>

      {kit.upgradeNext && (
        <div className="flex items-start gap-2 border-t border-line bg-brand-500/[0.05] px-4 py-3 text-[12.5px] leading-relaxed text-ink2">
          <TrendingUp className="mt-0.5 h-4 w-4 flex-none text-brand-500" />
          <span>
            <span className="font-semibold text-ink">Upgrade next:</span> add the {kit.upgradeNext.label.toLowerCase()} ({kit.upgradeNext.product.name}, {money(kit.upgradeNext.product.price)}) once cash flow allows — it's the biggest gap in this setup.
          </span>
        </div>
      )}
    </div>
  );
}

const RANK_META = {
  best: { label: "Best choice", icon: <Trophy className="h-3 w-3" />, cls: "bg-success/12 text-success" },
  alt: { label: "Alternative", icon: <Medal className="h-3 w-3" />, cls: "bg-brand-500/12 text-brand-500" },
  premium: { label: "Premium", icon: <Sparkles className="h-3 w-3" />, cls: "bg-violet/12 text-violet" },
} as const;

function TrioPick({ rank, product, budget, onOpen }: {
  rank: keyof typeof RANK_META; product: Product; budget: number; onOpen: (p: Product) => void;
}) {
  const meta = RANK_META[rank];
  const over = product.price > budget;
  return (
    <button
      onClick={() => onOpen(product)}
      className="surface gloss-card group flex flex-col rounded-2xl p-3 text-left transition hover:border-brand-500/40 hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]", meta.cls)}>
          {meta.icon}{meta.label}
        </span>
        <Stars rating={product.rating} />
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        <ProductThumb product={product} className="h-12 w-12 flex-none" iconClass="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">{product.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-display text-[14px] font-bold tnum text-ink">{money(product.price)}</span>
            {over && <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-danger">Over budget</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 line-clamp-1 text-[11px] text-ink3">{useCaseOf(product)}</div>
    </button>
  );
}

// ---- Shared wizard bits ---------------------------------------------------

function Question({ icon, step, title, children }: { icon: React.ReactNode; step: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-500/10 text-brand-500">{icon}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">Step {step}</span>
        <h3 className="text-[14.5px] font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Choice({ selected, onClick, title, blurb }: { selected: boolean; onClick: () => void; title: string; blurb?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn("flex flex-col items-start rounded-xl border p-3 text-left transition", selected ? "border-brand-500 bg-brand-500/[0.06] ring-1 ring-brand-500/30" : "border-line hover:border-ink3")}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={cn("text-[13.5px] font-semibold", selected ? "text-brand-500" : "text-ink")}>{title}</span>
        {selected && <Check className="h-4 w-4 flex-none text-brand-500" />}
      </div>
      {blurb && <span className="mt-0.5 text-[11.5px] text-ink3">{blurb}</span>}
    </button>
  );
}

function SectionHead({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-4 w-4" /></span>
      <div>
        <h3 className="font-display text-[16px] font-bold leading-tight tracking-tight text-ink">{title}</h3>
        {subtitle && <div className="text-[11.5px] text-ink3">{subtitle}</div>}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[12px] font-semibold text-brand-500">{children}</span>;
}

// ---------------------------------------------------------------------------
// AI Assistant
// ---------------------------------------------------------------------------

const SUGGESTED = [
  "What should I buy with $500?",
  "Should I buy an extractor or a steamer first?",
  "What equipment should I upgrade next?",
  "Is a $90 dual-action polisher worth it for a beginner?",
];

function Assistant() {
  const { configured, loading, answer, error, asked, ask, reset } = useGearAssistant();
  const locker = useGearLocker();
  const [question, setQuestion] = useState("");
  const [currentEquipment, setCurrentEquipment] = useState("");

  // Ground the assistant in the profile the detailer built, if any.
  const defaults: AssistantContext = {
    experience: locker.profile?.experience ? EXPERIENCE_OPTIONS.find((e) => e.key === locker.profile!.experience)?.label : undefined,
    budget: locker.profile?.budgetCeiling ? `Up to $${locker.profile.budgetCeiling.toLocaleString()}` : undefined,
    goal: locker.profile?.business ? BUSINESS_OPTIONS.find((b) => b.key === locker.profile!.business)?.label : undefined,
  };

  const canAsk = question.trim().length >= 3 && !loading && configured === true;

  const submit = async () => {
    if (!canAsk) return;
    try {
      await ask(question.trim(), { ...defaults, currentEquipment: currentEquipment.trim() || undefined });
    } catch {
      /* surfaced via hook state */
    }
  };

  if (configured === null) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink3" /></div>;
  }

  if (configured === false) {
    return (
      <EmptyState
        art="spray"
        title="The AI assistant isn't switched on yet"
        body="Once an Anthropic API key is set on the server, you'll be able to ask free-form questions about gear, products, and business decisions here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Sparkles className="h-4 w-4" /></div>
            <div>
              <div className="text-[14.5px] font-semibold text-ink">Ask the Detailer Gear Assistant</div>
              <div className="text-[12.5px] text-ink3">Describe your situation — budget, vehicles you service, business size, goals — and get a straight recommendation.</div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-ink2">Your question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
              rows={3} maxLength={1000}
              placeholder="e.g. I do exterior details and want to add interior shampoo — what should I buy first?"
              className="w-full resize-y rounded-lg border border-line bg-panel px-3 py-2.5 text-[13.5px] text-ink outline-none transition placeholder:text-ink3 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-ink2">What you already own <span className="text-ink3">(optional — makes advice sharper)</span></label>
            <input
              value={currentEquipment}
              onChange={(e) => setCurrentEquipment(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Sun Joe pressure washer, shop vac, cheap foam cannon"
              className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13.5px] text-ink outline-none transition placeholder:text-ink3 focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => setQuestion(s)} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink2 transition hover:border-brand-500 hover:text-brand-500">{s}</button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={!canAsk}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 text-[13.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? "Thinking…" : "Ask"}
            </button>
            {(answer || error) && !loading && (
              <button onClick={() => { reset(); setQuestion(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3">
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {error && !loading && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">{error}</div>}
      {answer && !loading && <AnswerView answer={answer} question={asked} />}

      <p className="pb-4 text-center text-[11.5px] text-ink3">
        AI-generated guidance. Prices are approximate and not sponsored — confirm current pricing before buying, and use your own judgment.
      </p>
    </div>
  );
}

function AnswerView({ answer, question }: { answer: AssistantAnswer; question: string | null }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        {question && <div className="text-[12.5px] font-medium text-ink3">You asked: “{question}”</div>}

        {answer.recommendation && (
          <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand-500">
              <Trophy className="h-3.5 w-3.5" /> Recommendation
            </div>
            <p className="text-[14px] font-semibold leading-snug text-ink">{answer.recommendation}</p>
          </div>
        )}

        {answer.explanation && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Why</div>
            <p className="text-[13.5px] leading-relaxed text-ink2">{answer.explanation}</p>
          </div>
        )}

        {(answer.pros.length > 0 || answer.cons.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {answer.pros.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-success"><ThumbsUp className="h-3.5 w-3.5" /> Pros</div>
                <ul className="flex flex-col gap-1.5">
                  {answer.pros.map((p) => <li key={p} className="flex items-start gap-1.5 text-[13px] text-ink2"><Check className="mt-0.5 h-3.5 w-3.5 flex-none text-success" />{p}</li>)}
                </ul>
              </div>
            )}
            {answer.cons.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-danger"><ThumbsDown className="h-3.5 w-3.5" /> Cons</div>
                <ul className="flex flex-col gap-1.5">
                  {answer.cons.map((c) => <li key={c} className="flex items-start gap-1.5 text-[13px] text-ink2"><X className="mt-0.5 h-3.5 w-3.5 flex-none text-danger" />{c}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {answer.alternatives.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Alternatives</div>
            <div className="flex flex-col gap-2">
              {answer.alternatives.map((a) => (
                <div key={a.name} className="rounded-lg border border-line bg-panel2/40 px-3 py-2">
                  <span className="text-[13px] font-semibold text-ink">{a.name}</span>
                  {a.note && <span className="text-[12.5px] text-ink3"> — {a.note}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {answer.learn && (
          <div className="flex items-start gap-2 rounded-xl bg-violet/[0.07] px-3.5 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-violet" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-violet">Learn</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">{answer.learn}</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
