import { useEffect, useMemo, useState } from "react";
import {
  Plus, Copy, Check, Download, Send, Trash2, Info, Mail, MessageSquare,
  FileText, Users, Pencil, Files, LayoutTemplate, type LucideIcon,
} from "lucide-react";
import { api as apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IconBtn, EmptyState, SignInPrompt } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { FeatureLocked } from "@/components/UpgradeGate";
import { CampaignComposer } from "@/components/marketing/CampaignComposer";
import { useEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { segmentLabel, customersInSegment, reachable, toCsv, type SegmentKey } from "@/lib/segments";
import { CAMPAIGN_STATUS_LABEL, type Campaign } from "@/lib/models";
import { isDemo } from "@/lib/demo";
import { cn } from "@/lib/cn";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

type Delivery = { email: { provider: string; live: boolean }; sms: { provider: string; live: boolean } } | null;

export default function Marketing() {
  const ent = useEntitlements();
  const { org } = useAuth();
  const api = useCampaigns();
  const { customers } = useCustomers();
  const { appointments } = useAppointments();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [startTemplates, setStartTemplates] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [delivery, setDelivery] = useState<Delivery>(null);

  const businessName = org?.name ?? "our shop";

  // Ask the server what's actually wired, so the page never over-promises.
  useEffect(() => {
    let on = true;
    // Demo makes zero external calls (no JWT to authenticate with anyway).
    if (isDemo()) return;
    apiFetch<Delivery>("/notify/status")
      .then((d) => on && setDelivery(d))
      .catch(() => on && setDelivery(null));
    return () => { on = false; };
  }, []);

  const listFor = (c: Campaign) => reachable(customersInSegment(c.segment as SegmentKey, customers, appointments), c.channel);

  // Real campaign metrics — nothing fabricated (the schema tracks draft/sent).
  const stats = useMemo(() => {
    const drafts = api.campaigns.filter((c) => c.status === "draft").length;
    const sent = api.campaigns.filter((c) => c.status === "sent").length;
    const delivered = api.campaigns.reduce((s, c) => s + (c.status === "sent" ? c.recipient_count ?? 0 : 0), 0);
    return { drafts, sent, delivered, customers: customers.length };
  }, [api.campaigns, customers.length]);

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

  const openNew = () => { setEditing(null); setStartTemplates(false); setOpen(true); };
  const openTemplates = () => { setEditing(null); setStartTemplates(true); setOpen(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setStartTemplates(false); setOpen(true); };

  const duplicate = async (c: Campaign) => {
    try {
      await api.create({ name: `${c.name} (copy)`, segment: c.segment, channel: c.channel, subject: c.subject, message: c.message });
      toast.success("Campaign duplicated");
    } catch (e) { toast.error((e as Error).message); }
  };

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

  const sendCampaign = async (c: Campaign) => {
    const list = listFor(c);
    setNotice(null);
    if (!delivery) {
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
    } finally { setSending(null); }
  };

  const removeCampaign = async (c: Campaign) => {
    if (await confirm({ title: `Delete “${c.name}”?`, body: "This permanently removes the campaign.", confirmLabel: "Delete campaign", tone: "danger" })) {
      try { await api.remove(c.id); toast.success("Campaign deleted"); } catch (e) { toast.error((e as Error).message); }
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Campaigns"
        subtitle="Turn your customer list into repeat business"
        actions={<Button variant="primary" icon={<Plus />} onClick={openNew}>New campaign</Button>}
      />

      {/* Dashboard — real metrics only */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard icon={FileText} tone="blue" label="Drafts" value={String(stats.drafts)} />
        <StatCard icon={Send} tone="green" label="Sent" value={String(stats.sent)} />
        <StatCard icon={Mail} tone="purple" label="Messages delivered" value={stats.delivered.toLocaleString()} />
        <StatCard icon={Users} tone="orange" label="Customers reached" value={stats.customers.toLocaleString()} />
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
              <b>logged, not delivered</b>. You can still <b>copy the list</b> or <b>export a CSV</b> to send from your own tool.
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
          title="Turn your customer list into repeat business"
          body="Create a campaign to bring customers back, promote your services, or stay connected — no writing from scratch required."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button variant="primary" icon={<Plus />} onClick={openNew}>Create campaign</Button>
              <Button icon={<LayoutTemplate />} onClick={openTemplates}>Browse templates</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {api.campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              recipients={c.status === "sent" ? (c.recipient_count ?? 0) : listFor(c).length}
              copied={copied === c.id}
              sending={sending === c.id}
              delivery={Boolean(delivery)}
              onEdit={() => openEdit(c)}
              onDuplicate={() => duplicate(c)}
              onCopy={() => copyList(c)}
              onExport={() => exportCsv(c)}
              onSend={() => sendCampaign(c)}
              onDelete={() => removeCampaign(c)}
            />
          ))}
        </div>
      )}

      <CampaignComposer
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        businessName={businessName}
        customers={customers}
        appointments={appointments}
        delivery={delivery}
        startOnTemplates={startTemplates}
        onCreate={api.create}
        onUpdate={api.update}
        onSendNow={api.send}
        onSaved={(msg) => { toast.success(msg); }}
      />
    </div>
  );
}

// --------------------------------------------------------------- components

const TONE: Record<string, { bg: string; icon: string }> = {
  blue: { bg: "bg-brand-500/10", icon: "text-brand-500" },
  green: { bg: "bg-success/10", icon: "text-success" },
  purple: { bg: "bg-violet/10", icon: "text-violet" },
  orange: { bg: "bg-warning/10", icon: "text-warning" },
};

function StatCard({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: keyof typeof TONE; label: string; value: string }) {
  const t = TONE[tone];
  return (
    <div className="surface rounded-xl p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", t.bg, t.icon)}><Icon className="h-3.5 w-3.5" /></span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 truncate font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
    </div>
  );
}

function CampaignCard({ c, recipients, copied, sending, delivery, onEdit, onDuplicate, onCopy, onExport, onSend, onDelete }: {
  c: Campaign; recipients: number; copied: boolean; sending: boolean; delivery: boolean;
  onEdit: () => void; onDuplicate: () => void; onCopy: () => void; onExport: () => void; onSend: () => void; onDelete: () => void;
}) {
  const isSent = c.status === "sent";
  const ChannelIcon = c.channel === "sms" ? MessageSquare : Mail;
  return (
    <div className="surface group flex flex-col rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start gap-2">
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-display text-[15px] font-bold tracking-tight text-ink group-hover:text-brand-500">{c.name}</span>
        </button>
        <span className={cn("flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold",
          isSent ? "bg-success/10 text-success" : "bg-line2 text-ink2")}>
          {CAMPAIGN_STATUS_LABEL[c.status]}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink2">
          <ChannelIcon className="h-3 w-3" />{c.channel === "sms" ? "SMS" : "Email"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink2">
          <Users className="h-3 w-3" />{segmentLabel(c.segment)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[12px] text-ink3">
        <span><b className="tnum text-ink">{recipients}</b> recipient{recipients === 1 ? "" : "s"}</span>
        <span className="ml-auto">{isSent ? `Sent ${fmtDate(c.sent_at)}` : `Created ${fmtDate(c.created_at)}`}</span>
      </div>

      <div className="mt-2 flex items-center gap-0.5">
        <IconBtn label="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
        <IconBtn label="Duplicate" onClick={onDuplicate}><Files className="h-4 w-4" /></IconBtn>
        <IconBtn label="Copy recipients" onClick={onCopy}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</IconBtn>
        <IconBtn label="Export CSV" onClick={onExport}><Download className="h-4 w-4" /></IconBtn>
        {!isSent && (
          <IconBtn label={delivery ? "Send campaign" : "Mark as sent"} disabled={sending} onClick={onSend}><Send className="h-4 w-4" /></IconBtn>
        )}
        <div className="ml-auto">
          <IconBtn label="Delete" danger onClick={onDelete}><Trash2 className="h-4 w-4" /></IconBtn>
        </div>
      </div>
    </div>
  );
}
