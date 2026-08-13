import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, RefreshCw, Check, Mail, MessageSquare, ArrowLeft, ArrowRight,
  Loader2, Users, Wand2, LayoutTemplate, Send, FileText,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  SEGMENTS, customersInSegment, reachable, renderMessage, type SegmentKey,
} from "@/lib/segments";
import {
  PURPOSES, TONES, OFFERS, VARIABLES, STARTER_TEMPLATES, generateVariations,
  type Purpose, type Tone, type OfferKind,
} from "@/lib/messageTemplates";
import type { Campaign, Customer, Appointment } from "@/lib/models";
import type { CampaignInput, SendResult } from "@/hooks/useCampaigns";

type Delivery = { email: { provider: string; live: boolean }; sms: { provider: string; live: boolean } } | null;

const STEPS = ["Details", "Audience", "Message", "Review"] as const;

export function CampaignComposer({
  open, onClose, editing, businessName, customers, appointments, delivery,
  startOnTemplates = false, onCreate, onUpdate, onSendNow, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Campaign | null;
  businessName: string;
  customers: Customer[];
  appointments: Appointment[];
  delivery: Delivery;
  startOnTemplates?: boolean;
  onCreate: (input: CampaignInput) => Promise<Campaign>;
  onUpdate: (id: string, input: CampaignInput) => Promise<Campaign>;
  onSendNow: (id: string) => Promise<SendResult>;
  onSaved: (msg: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("win_back");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [segment, setSegment] = useState<SegmentKey>("lapsed_90");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [offer, setOffer] = useState<OfferKind>("none");
  const [offerValue, setOfferValue] = useState("");
  const [variations, setVariations] = useState<string[]>([]);
  const [genSeed, setGenSeed] = useState(1);
  const [sendChoice, setSendChoice] = useState<"draft" | "now">("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setChannel((editing.channel as "email" | "sms") || "email");
      setSubject(editing.subject ?? ""); setSegment(editing.segment as SegmentKey); setMessage(editing.message);
    } else {
      setName(""); setChannel("email"); setSubject(""); setSegment("lapsed_90"); setMessage("");
    }
    setPurpose("win_back"); setTone("friendly"); setOffer("none"); setOfferValue("");
    setVariations([]); setGenSeed(1); setSendChoice("draft"); setError(null);
    setShowTemplates(startOnTemplates);
    setStep(startOnTemplates ? 2 : 0);
  }, [open, editing, startOnTemplates]);

  // Live audience + reachable recipients for the chosen segment/channel.
  const audience = useMemo(
    () => customersInSegment(segment, customers, appointments),
    [segment, customers, appointments],
  );
  const recipients = useMemo(() => reachable(audience, channel), [audience, channel]);
  const segCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SEGMENTS) m[s.key] = customersInSegment(s.key, customers, appointments).length;
    return m;
  }, [customers, appointments]);

  const sampleName = recipients[0]?.name ?? "John Smith";
  const canSendNow = Boolean(delivery) && recipients.length > 0;

  if (!open) return null;

  const pickPurpose = (p: Purpose) => {
    setPurpose(p);
    const def = PURPOSES.find((x) => x.key === p)!;
    setSegment(def.segment);
    if (!subject.trim() || !editing) setSubject(def.subject);
    if (!name.trim()) setName(def.label);
  };

  const applyTemplate = (id: string) => {
    const t = STARTER_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setChannel(t.channel); setSegment(t.segment); setSubject(t.subject); setMessage(t.message);
    if (!name.trim()) setName(t.name);
    setShowTemplates(false);
  };

  const runGenerate = (seed: number) => setVariations(generateVariations({ purpose, tone, offer, offerValue }, 3, seed));
  const generate = () => { setGenSeed(1); runGenerate(1); };
  const generateMore = () => { const s = genSeed + 1; setGenSeed(s); runGenerate(s); };

  const insertVar = (token: string) => {
    const ta = taRef.current;
    if (!ta) { setMessage((m) => m + token); return; }
    const s = ta.selectionStart ?? message.length;
    const e = ta.selectionEnd ?? message.length;
    setMessage(message.slice(0, s) + token + message.slice(e));
    requestAnimationFrame(() => { ta.focus(); const p = s + token.length; ta.setSelectionRange(p, p); });
  };

  const next = () => {
    if (step === 0 && !name.trim()) return setError("Give the campaign a name.");
    if (step === 2 && !message.trim()) return setError("Write a message first.");
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  const launch = async () => {
    if (!name.trim()) { setStep(0); return setError("Give the campaign a name."); }
    if (!message.trim()) { setStep(2); return setError("Write a message first."); }
    setBusy(true); setError(null);
    try {
      const input: CampaignInput = {
        name: name.trim(), segment, channel,
        subject: channel === "email" ? subject.trim() || null : null,
        message,
      };
      const camp = editing ? await onUpdate(editing.id, input) : await onCreate(input);
      if (sendChoice === "now" && canSendNow) {
        const r = await onSendNow(camp.id);
        onSaved(`“${name.trim()}” sent to ${r.sent} of ${r.audience} via ${r.provider}${r.failed ? ` · ${r.failed} failed` : ""}.`);
      } else {
        onSaved(editing ? "Campaign updated" : "Campaign saved as draft");
      }
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const footer = (
    <>
      {step > 0
        ? <Button onClick={back} icon={<ArrowLeft />}>Back</Button>
        : <Button onClick={onClose}>Cancel</Button>}
      {step < STEPS.length - 1
        ? <Button variant="primary" onClick={next}>Next<ArrowRight className="h-4 w-4" /></Button>
        : <Button variant="primary" onClick={launch} disabled={busy} icon={busy ? <Loader2 className="animate-spin" /> : undefined}>
            {busy ? "Working…" : editing ? "Save changes" : sendChoice === "now" ? "Save & send" : "Save campaign"}
          </Button>}
    </>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? "Edit campaign" : "New campaign"} footer={footer}>
      <div className="flex flex-col gap-5">
        <Stepper step={step} />

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Label text="Campaign name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="July win-back" />
            </Label>
            <div>
              <LabelText text="Goal" hint="Pre-fills your audience & message" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PURPOSES.map((p) => (
                  <button key={p.key} type="button" onClick={() => pickPurpose(p.key)}
                    className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold transition-[border-color,background-color] duration-150",
                      purpose === p.key ? "border-brand-500 bg-brand-500/[0.07] text-ink" : "border-line bg-panel2/50 text-ink2 hover:border-ink3/50")}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <LabelText text="Channel" />
              <div className="grid grid-cols-2 gap-2">
                <ChannelBtn active={channel === "email"} onClick={() => setChannel("email")} icon={<Mail className="h-4 w-4" />} label="Email" />
                <ChannelBtn active={channel === "sms"} onClick={() => setChannel("sms")} icon={<MessageSquare className="h-4 w-4" />} label="SMS" />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <LabelText text="Who should receive this?" hint="Recomputed live at send time" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SEGMENTS.map((s) => (
                <button key={s.key} type="button" onClick={() => setSegment(s.key)}
                  className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150",
                    segment === s.key ? "border-brand-500 bg-brand-500/[0.06]" : "border-line bg-panel2/40 hover:border-ink3/50")}>
                  <span className={cn("mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg",
                    segment === s.key ? "bg-brand-500/15 text-brand-500" : "bg-line2 text-ink3")}>
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{s.label}</span>
                      <span className="ml-auto font-display text-[15px] font-bold tnum text-ink">{segCounts[s.key] ?? 0}</span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink3">{s.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-panel2/60 px-3.5 py-2.5 text-[12.5px] text-ink2">
              <Send className="h-3.5 w-3.5 flex-none text-brand-500" />
              <span><b className="text-ink">{recipients.length}</b> of {audience.length} have {channel === "sms" ? "a phone number" : "an email"} on file and will be reached.</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
            {/* Editor + generator */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {/* Template / generator toggles */}
              <div className="flex flex-wrap gap-2">
                <ToolChip active={!showTemplates} onClick={() => setShowTemplates(false)} icon={<Wand2 className="h-3.5 w-3.5" />} label="Generator" />
                <ToolChip active={showTemplates} onClick={() => setShowTemplates(true)} icon={<LayoutTemplate className="h-3.5 w-3.5" />} label="Templates" />
              </div>

              {showTemplates ? (
                <div className="grid grid-cols-2 gap-2">
                  {STARTER_TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
                      className="flex items-center gap-2 rounded-lg border border-line bg-panel2/50 px-3 py-2.5 text-left text-[12px] font-semibold text-ink2 transition-[border-color,color] duration-150 hover:border-brand-500/50 hover:text-ink">
                      <FileText className="h-3.5 w-3.5 flex-none text-brand-500" />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-panel2/50 p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <LabelText text="Tone" small />
                      <select className="input h-9" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                        {TONES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <LabelText text="Offer" small />
                      <select className="input h-9" value={offer} onChange={(e) => setOffer(e.target.value as OfferKind)}>
                        {OFFERS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {offer !== "none" && (
                    <input className="input mt-2.5 h-9" value={offerValue} onChange={(e) => setOfferValue(e.target.value)}
                      placeholder={offer === "percent" ? "15" : offer === "dollar" ? "20" : "a free interior wipe-down"} />
                  )}
                  <button type="button" onClick={variations.length ? generateMore : generate}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 text-[13px] font-semibold text-white shadow-glow transition hover:brightness-[1.06] active:scale-[0.98]">
                    {variations.length ? <><RefreshCw className="h-4 w-4" /> Generate more</> : <><Sparkles className="h-4 w-4" /> Generate messages</>}
                  </button>
                  {variations.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-2">
                      {variations.map((v, i) => {
                        const selected = v === message;
                        return (
                          <button key={i} type="button" onClick={() => setMessage(v)}
                            className={cn("rounded-lg border px-3 py-2 text-left text-[12.5px] leading-relaxed transition-[border-color,background-color] duration-150",
                              selected ? "border-brand-500 bg-brand-500/[0.06] text-ink" : "border-line bg-panel text-ink2 hover:border-brand-500/40")}>
                            <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">
                              Option {i + 1}{selected && <Check className="h-3 w-3 text-brand-500" />}
                            </span>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {channel === "email" && (
                <Label text="Subject">
                  <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="We miss your car" />
                </Label>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <LabelText text="Message" inline />
                  <span className={cn("text-[11px] tnum", channel === "sms" && message.length > 320 ? "text-warning" : "text-ink3")}>
                    {message.length} chars{channel === "sms" && ` · ${Math.max(1, Math.ceil(message.length / 160))} SMS`}
                  </span>
                </div>
                <textarea ref={taRef} className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message, generate one above, or start from a template…" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">Insert:</span>
                  {VARIABLES.map((v) => (
                    <button key={v.token} type="button" onClick={() => insertVar(v.token)}
                      className="rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] font-medium text-ink2 transition-colors hover:border-brand-500/50 hover:text-brand-500">
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="lg:w-[300px] lg:flex-none">
              <LabelText text="Preview" small />
              <Preview channel={channel} subject={subject} businessName={businessName}
                body={renderMessage(message || "Your message will appear here…", sampleName, businessName)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-panel2/40 p-4">
              <SummaryRow label="Campaign" value={name || "—"} />
              <SummaryRow label="Channel" value={channel === "sms" ? "SMS" : "Email"} />
              <SummaryRow label="Audience" value={`${SEGMENTS.find((s) => s.key === segment)?.label ?? segment} · ${recipients.length} reachable`} />
              {channel === "email" && <SummaryRow label="Subject" value={subject || "—"} />}
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">Message preview</div>
                <div className="whitespace-pre-wrap rounded-lg bg-panel p-3 text-[13px] leading-relaxed text-ink">
                  {renderMessage(message || "—", sampleName, businessName)}
                </div>
              </div>
            </div>

            <div>
              <LabelText text="When to send" />
              <div className="grid gap-2 sm:grid-cols-2">
                <SendChoiceBtn active={sendChoice === "draft"} onClick={() => setSendChoice("draft")}
                  title="Save as draft" desc="Review and send it from the list whenever you're ready." />
                <SendChoiceBtn active={sendChoice === "now"} onClick={() => canSendNow && setSendChoice("now")} disabled={!canSendNow}
                  title="Send now" desc={canSendNow ? `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"} on save.` : "Needs reachable recipients and delivery configured."} />
              </div>
            </div>
          </div>
        )}

        {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- primitives

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1.5">
          <div className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold transition-colors",
            i < step ? "bg-brand-500 text-white" : i === step ? "bg-brand-500/15 text-brand-500 ring-1 ring-brand-500" : "bg-line2 text-ink3")}>
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn("hidden text-[11.5px] font-semibold sm:inline", i === step ? "text-ink" : "text-ink3")}>{s}</span>
          {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-brand-500/50" : "bg-line")} />}
        </div>
      ))}
    </div>
  );
}

function LabelText({ text, hint, small, inline }: { text: string; hint?: string; small?: boolean; inline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", !inline && "mb-1.5", small ? "mb-1" : "")}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">{text}</span>
      {hint && <span className="text-[11px] font-medium normal-case tracking-normal text-ink3">{hint}</span>}
    </div>
  );
}

function Label({ text, required, children }: { text: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">
        {text}{required && <span className="text-danger" aria-hidden>*</span>}
      </span>
      {children}
    </label>
  );
}

function ChannelBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-[border-color,background-color,color] duration-150",
        active ? "border-brand-500 bg-brand-500/[0.07] text-brand-500" : "border-line bg-panel2/50 text-ink2 hover:border-ink3/50")}>
      {icon}{label}
    </button>
  );
}

function ToolChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-[border-color,background-color,color] duration-150",
        active ? "border-brand-500 bg-brand-500/[0.08] text-brand-500" : "border-line bg-panel2/50 text-ink3 hover:text-ink")}>
      {icon}{label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <span className="w-[76px] flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</span>
      <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

function SendChoiceBtn({ active, onClick, disabled, title, desc }: {
  active: boolean; onClick: () => void; disabled?: boolean; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 disabled:opacity-50",
        active ? "border-brand-500 bg-brand-500/[0.06]" : "border-line bg-panel2/40 enabled:hover:border-ink3/50")}>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", active ? "border-brand-500 bg-brand-500 text-white" : "border-ink3")}>
          {active && <Check className="h-3 w-3" />}
        </span>
        {title}
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-ink3">{desc}</div>
    </button>
  );
}

/** Polished SMS/email preview that updates live with the message. */
function Preview({ channel, subject, body, businessName }: { channel: "email" | "sms"; subject: string; body: string; businessName: string }) {
  if (channel === "sms") {
    return (
      <div className="mx-auto w-full max-w-[280px] rounded-[26px] border border-line bg-panel2 p-2 shadow-card">
        <div className="rounded-[20px] bg-ground px-3 pb-4 pt-3">
          <div className="mb-3 text-center text-[11px] font-semibold text-ink3">Messages</div>
          <div className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-line2 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
              {body}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-panel shadow-card">
      <div className="border-b border-line bg-panel2/60 px-3.5 py-2.5">
        <div className="text-[11px] text-ink3">From <span className="font-semibold text-ink2">{businessName}</span></div>
        <div className="mt-0.5 truncate text-[13px] font-bold text-ink">{subject || "(no subject)"}</div>
      </div>
      <div className="whitespace-pre-wrap px-3.5 py-3 text-[12.5px] leading-relaxed text-ink">{body}</div>
    </div>
  );
}
