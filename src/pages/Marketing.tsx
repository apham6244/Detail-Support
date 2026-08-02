import { useEffect, useMemo, useState } from "react";
import { Plus, Users, Copy, Check, Download, Send, Trash2, Info } from "lucide-react";
import { api as apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Th, Td, IconBtn, EmptyState, SignInPrompt } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { useCampaigns, type CampaignInput } from "@/hooks/useCampaigns";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { SEGMENTS, segmentLabel, customersInSegment, renderMessage, reachable, toCsv, type SegmentKey } from "@/lib/segments";
import { CAMPAIGN_STATUS_LABEL, type Campaign } from "@/lib/models";
import { cn } from "@/lib/cn";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

const DEFAULT_MSG =
  "Hi [Customer Name], it's been a while since your last detail at [Business Name]. Book this month and we'll take great care of your car.";

export default function Marketing() {
  const ent = useEntitlements();
  const { org } = useAuth();
  const api = useCampaigns();
  const { customers } = useCustomers();
  const { appointments } = useAppointments();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<SegmentKey>("lapsed_90");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [delivery, setDelivery] = useState<{ email: { provider: string; live: boolean }; sms: { provider: string; live: boolean } } | null>(null);

  const businessName = org?.name ?? "our shop";

  // Ask the server what's actually wired, so the page never over-promises.
  useEffect(() => {
    let on = true;
    apiFetch<typeof delivery>("/notify/status")
      .then((d) => on && setDelivery(d))
      .catch(() => on && setDelivery(null));
    return () => { on = false; };
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SEGMENTS) m[s.key] = customersInSegment(s.key, customers, appointments).length;
    return m;
  }, [customers, appointments]);

  const recipients = useMemo(
    () => reachable(customersInSegment(segment, customers, appointments), channel),
    [segment, channel, customers, appointments]
  );

  if (ent.loading) return <PageSkeleton variant="table" kpis={4} />;
  if (!ent.hasFeature("marketing")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Marketing" subtitle="Bring customers back" />
        <FeatureLocked
          feature="marketing"
          title="Marketing tools"
          description="Target customer segments — new, repeat, or lapsed — with personalised campaigns that bring cars back to your bay."
        />
      </div>
    );
  }
  if (!api.ready) return <SignInPrompt what="marketing" />;

  const openNew = () => {
    setEditing(null);
    setName("");
    setSegment("lapsed_90");
    setChannel("email");
    setSubject("");
    setMessage(DEFAULT_MSG);
    setError(null);
    setOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setName(c.name);
    setSegment(c.segment as SegmentKey);
    setChannel(c.channel);
    setSubject(c.subject ?? "");
    setMessage(c.message);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return setError("Give the campaign a name.");
    setBusy(true);
    setError(null);
    try {
      const input: CampaignInput = { name, segment, channel, subject: subject || null, message };
      if (editing) await api.update(editing.id, input);
      else await api.create(input);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const listFor = (c: Campaign) => reachable(customersInSegment(c.segment as SegmentKey, customers, appointments), c.channel);

  const copyList = async (c: Campaign) => {
    const list = listFor(c);
    const field = c.channel === "sms" ? "phone" : "email";
    await navigator.clipboard.writeText(list.map((x) => (x as any)[field]).filter(Boolean).join(", "));
    setCopied(c.id);
    setTimeout(() => setCopied(null), 1800);
  };

  const exportCsv = (c: Campaign) => {
    const csv = toCsv(listFor(c));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.name.replace(/\W+/g, "-").toLowerCase()}-recipients.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Marketing"
        subtitle="Bring customers back with targeted campaigns"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={openNew}>
            New campaign
          </Button>
        }
      />

      {/* Segments — borderless band, dividers instead of cards */}
      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-7 border-y border-line py-6 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-line">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">{s.label}</span>
            </div>
            <div className="mt-2 font-display text-[27px] font-bold leading-none tnum text-ink">{counts[s.key] ?? 0}</div>
            <div className="mt-2 text-xs text-ink3">{s.description}</div>
          </div>
        ))}
      </div>

      {notice && (
        <div className={cn("mb-4 rounded-xl border px-4 py-3 text-[13px] font-medium",
          notice.kind === "ok" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>
          {notice.text}
        </div>
      )}

      {/* What delivery actually does right now — straight from the server */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-line bg-panel2/60 px-4 py-3 text-[12.5px] text-ink2">
        <Info className="mt-0.5 h-4 w-4 flex-none text-brand-500" />
        {delivery ? (
          delivery.email.live || delivery.sms.live ? (
            <span>
              Sending is live — email via <b>{delivery.email.provider}</b>
              {delivery.sms.live ? <> and SMS via <b>{delivery.sms.provider}</b></> : <> (SMS still logs only)</>}.
              Recipients are recomputed from your current customer list at send time.
            </span>
          ) : (
            <span>
              Sends run through the server but the provider is set to <b>console</b>, so messages are{" "}
              <b>logged, not delivered</b>. Set <code>EMAIL_PROVIDER=sendgrid</code> (and{" "}
              <code>SMS_PROVIDER=twilio</code>) to go live. You can still <b>copy the list</b> or{" "}
              <b>export a CSV</b> to send from your own tool.
            </span>
          )
        ) : (
          <span>
            The API isn't reachable, so campaigns can't send from here. <b>Copy the list</b> or{" "}
            <b>export a CSV</b> to send from your own tool, then mark the campaign sent.
          </span>
        )}
      </div>

      {/* Campaigns */}
      {api.loading ? (
        <PageSkeleton variant="table" kpis={0} header={false} toolbar={false} />
      ) : api.campaigns.length === 0 ? (
        <EmptyState
          art="megaphone"
          title="No campaigns yet"
          body="Pick a segment — lapsed customers are the easiest win — and write a message that brings them back."
          action={
            <Button variant="primary" icon={<Plus />} onClick={openNew}>
              New campaign
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-panel2 text-left text-[11px] uppercase tracking-[0.07em] text-ink3">
                <Th>Campaign</Th>
                <Th>Segment</Th>
                <Th>Recipients</Th>
                <Th>Status</Th>
                <Th>Sent</Th>
                <Th className="w-[150px]" />
              </tr>
            </thead>
            <tbody>
              {api.campaigns.map((c) => {
                const list = listFor(c);
                return (
                  <tr key={c.id} className="border-b border-line2 last:border-b-0">
                      <Td>
                        <button className="font-semibold text-ink hover:text-brand-500" onClick={() => openEdit(c)}>
                          {c.name}
                        </button>
                      </Td>
                      <Td className="text-ink2">{segmentLabel(c.segment)}</Td>
                      <Td className="tnum">{c.status === "sent" ? c.recipient_count : list.length}</Td>
                      <Td>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            c.status === "sent" ? "bg-success/10 text-success" : "bg-line2 text-ink2"
                          )}
                        >
                          {CAMPAIGN_STATUS_LABEL[c.status]}
                        </span>
                      </Td>
                      <Td className="text-ink2">{fmtDate(c.sent_at)}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn label="Copy recipients" onClick={() => copyList(c)}>
                            {copied === c.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                          </IconBtn>
                          <IconBtn label="Export CSV" onClick={() => exportCsv(c)}>
                            <Download className="h-4 w-4" />
                          </IconBtn>
                          {c.status === "draft" && (
                            <IconBtn
                              label={delivery ? "Send campaign" : "Mark as sent"}
                              disabled={sending === c.id}
                              onClick={async () => {
                                setNotice(null);
                                if (!delivery) {
                                  // No API — fall back to recording it manually.
                                  if (!(await confirm({ title: `Mark “${c.name}” as sent?`, body: `Records this campaign as delivered to ${list.length} recipient${list.length === 1 ? "" : "s"}.`, confirmLabel: "Mark as sent" }))) return;
                                  await api.markSent(c.id, list.length);
                                  toast.success("Campaign marked as sent");
                                  return;
                                }
                                if (!(await confirm({ title: `Send “${c.name}”?`, body: `This sends to ${list.length} ${c.channel === "sms" ? "phone" : "email"} recipient${list.length === 1 ? "" : "s"} right now.`, confirmLabel: "Send campaign" }))) return;
                                setSending(c.id);
                                try {
                                  const r = await api.send(c.id);
                                  setNotice({
                                    kind: r.failed > 0 ? "warn" : "ok",
                                    text: `“${c.name}” sent to ${r.sent} of ${r.audience} via ${r.provider}.` +
                                      (r.failed ? ` ${r.failed} failed.` : "") +
                                      (r.skipped ? ` ${r.skipped} skipped (no ${c.channel === "sms" ? "phone" : "email"}).` : ""),
                                  });
                                } catch (e) {
                                  setNotice({ kind: "warn", text: (e as Error).message });
                                } finally {
                                  setSending(null);
                                }
                              }}
                            >
                              <Send className="h-4 w-4" />
                            </IconBtn>
                          )}
                          <IconBtn
                            label="Delete"
                            danger
                            onClick={async () => { if (await confirm({ title: `Delete “${c.name}”?`, body: "This permanently removes the campaign.", confirmLabel: "Delete campaign", tone: "danger" })) { try { await api.remove(c.id); toast.success("Campaign deleted"); } catch (e) { toast.error((e as Error).message); } } }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconBtn>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      )}

      {/* Composer */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit campaign" : "New campaign"}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create campaign"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Campaign name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="July win-back" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience">
              <select className="input" value={segment} onChange={(e) => setSegment(e.target.value as SegmentKey)}>
                {SEGMENTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({counts[s.key] ?? 0})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel">
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </Field>
          </div>

          {channel === "email" && (
            <Field label="Subject">
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="We miss your car" />
            </Field>
          )}

          <Field label="Message">
            <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="-mt-2 text-[11.5px] text-ink3">
            Variables: <code className="rounded bg-panel2 px-1">[Customer Name]</code>{" "}
            <code className="rounded bg-panel2 px-1">[First Name]</code>{" "}
            <code className="rounded bg-panel2 px-1">[Business Name]</code>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-line bg-panel2/60 p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Preview</span>
              <span className="text-[11.5px] font-semibold text-brand-500">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-[13px] text-ink">
              {renderMessage(message, recipients[0]?.name ?? "Jordan Reyes", businessName)}
            </div>
            {recipients.length === 0 && (
              <div className="mt-2 text-[12px] text-warning">
                No one in this segment has {channel === "sms" ? "a phone number" : "an email"} on file.
              </div>
            )}
          </div>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}
