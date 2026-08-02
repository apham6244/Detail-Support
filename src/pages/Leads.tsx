import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Plus, Search, X as XIcon, Phone, Mail, Car, Wrench, DollarSign, Users, Trophy,
  XCircle, Pencil, Trash2, UserPlus, Clock, CalendarDays, ChevronRight, TrendingUp,
  MessageSquarePlus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { EmptyState, NoResults, SignInPrompt, IconBtn, money } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useLeads, useLeadActivities, type LeadInput } from "@/hooks/useLeads";
import { useAuth } from "@/lib/auth";
import {
  LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, LEAD_SOURCE_LABEL,
  type Lead, type LeadStatus, type LeadSource,
} from "@/lib/models";
import { cn } from "@/lib/cn";
import { AXIS } from "@/lib/metrics";

const tooltipStyle = {
  borderRadius: 10, border: "1px solid rgba(126,138,163,.25)",
  background: "rgb(var(--panel))", color: "rgb(var(--ink))", fontSize: 12,
};

const STATUS_META: Record<LeadStatus, { color: string; chip: string; dot: string }> = {
  new:        { color: "#2E7BFF", chip: "bg-brand-500/12 text-brand-500 ring-brand-500/25", dot: "bg-brand-500" },
  contacted:  { color: "#7A5BE0", chip: "bg-violet/12 text-violet ring-violet/25", dot: "bg-violet" },
  quote_sent: { color: "#E08A00", chip: "bg-warning/12 text-warning ring-warning/25", dot: "bg-warning" },
  scheduled:  { color: "#0EA5A5", chip: "bg-[#0EA5A5]/12 text-[#0EA5A5] ring-[#0EA5A5]/25", dot: "bg-[#0EA5A5]" },
  won:        { color: "#17A867", chip: "bg-success/12 text-success ring-success/25", dot: "bg-success" },
  lost:       { color: "#8A94A6", chip: "bg-line2 text-ink3 ring-line", dot: "bg-ink3" },
};

const EMPTY_FORM: LeadInput = { name: "", phone: "", email: "", vehicle: "", service: "", estimated_value: null, source: "facebook", status: "new", notes: "" };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const relDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const whenLabel = (iso: string | null) => {
  if (!iso) return "Never";
  const d = relDays(iso);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};
function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString(undefined, { month: "short" }) });
  }
  return out;
}
const monthKey = (iso: string) => iso.slice(0, 7);

type Sort = "newest" | "oldest" | "value";

export default function Leads() {
  const leadsApi = useLeads();
  const { leads, loading, ready, create, update } = leadsApi;
  const { role } = useAuth();
  const navigate = useNavigate();
  const canManage = role !== "employee";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

  const stats = useMemo(() => {
    const total = leads.length;
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const newThisMonth = leads.filter((l) => monthKey(l.created_at) === thisKey).length;
    const won = leads.filter((l) => l.status === "won").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const conversion = total ? Math.round((won / total) * 100) : 0;
    const revenue = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
    return { total, newThisMonth, won, lost, conversion, revenue };
  }, [leads]);

  const monthly = useMemo(() => {
    const months = lastMonths(6);
    const counts = new Map(months.map((m) => [m.key, 0]));
    for (const l of leads) counts.set(monthKey(l.created_at), (counts.get(monthKey(l.created_at)) ?? 0) + 1);
    return months.map((m) => ({ label: m.label, count: counts.get(m.key) ?? 0 }));
  }, [leads]);

  const bySource = useMemo(() => {
    return (Object.keys(LEAD_SOURCE_LABEL) as LeadSource[])
      .map((s) => ({ source: LEAD_SOURCE_LABEL[s], count: leads.filter((l) => l.source === s).length }))
      .filter((x) => x.count > 0);
  }, [leads]);

  const byStatus = useMemo(
    () => LEAD_STATUS_ORDER.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length })),
    [leads]
  );

  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let list = leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.phone ?? ""} ${l.email ?? ""} ${l.vehicle ?? ""} ${l.service ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === "value") return (b.estimated_value ?? 0) - (a.estimated_value ?? 0);
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [leads, deferredQuery, statusFilter, sourceFilter, sort]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (l: Lead) => { setEditing(l); setFormOpen(true); };

  const saveForm = async (input: LeadInput) => {
    if (editing) await update(editing.id, input);
    else await create(input);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Leads"
        subtitle="Your pipeline — from first enquiry to booked job"
        actions={ready ? <Button variant="primary" icon={<Plus />} onClick={openNew}>Add lead</Button> : undefined}
      />

      {!ready ? (
        <SignInPrompt what="leads" />
      ) : loading ? (
        <PageSkeleton variant="list" kpis={6} header={false} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<UserPlus />}
          title="No leads yet"
          body="Track every enquiry — from Instagram DMs to referrals — and move them through your pipeline until they book."
          action={<Button variant="primary" icon={<Plus />} onClick={openNew}>Add your first lead</Button>}
        />
      ) : (
        <>
          {/* KPI band */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-line py-6 md:grid-cols-3 lg:grid-cols-6 lg:gap-x-0 lg:divide-x lg:divide-line">
            <Kpi icon={Users} accent="brand" label="Total leads" value={String(stats.total)} />
            <Kpi icon={CalendarDays} accent="violet" label="New this month" value={String(stats.newThisMonth)} />
            <Kpi icon={TrendingUp} accent="warning" label="Conversion" value={`${stats.conversion}%`} />
            <Kpi icon={DollarSign} accent="success" label="Est. revenue" value={money(stats.revenue)} />
            <Kpi icon={Trophy} accent="success" label="Won" value={String(stats.won)} />
            <Kpi icon={XCircle} accent="ink" label="Lost" value={String(stats.lost)} />
          </div>

          {/* Charts */}
          <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-line pt-8 lg:grid-cols-2">
            <ChartBlock title="Leads over time" subtitle="Last 6 months">
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={monthly} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2E7BFF" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2E7BFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" name="Leads" stroke="#2E7BFF" strokeWidth={2.5} fill="url(#leadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBlock>

            <ChartBlock title="Leads by source" subtitle="Where they come from">
              {bySource.length === 0 ? (
                <MiniEmpty />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={bySource} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                    <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.15} />
                    <XAxis dataKey="source" tick={{ fontSize: 10.5, fill: AXIS }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(126,138,163,.08)" }} />
                    <Bar dataKey="count" name="Leads" radius={[5, 5, 0, 0]} barSize={26} fill="#2E7BFF" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartBlock>
          </div>

          {/* Pipeline by status — segmented bar */}
          <div className="mt-8 border-t border-line pt-8">
            <h2 className="mb-3 font-display text-[15px] font-bold tracking-tight text-ink">Pipeline by status</h2>
            <StatusBar byStatus={byStatus} total={stats.total} />
          </div>

          {/* Controls */}
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-8">
            <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
              <Search className="pointer-events-none absolute left-2.5 top-[9px] h-[17px] w-[17px] text-ink3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads…" className="input pl-8" />
            </div>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | "all")} className="input h-10 w-auto cursor-pointer text-[13px] font-medium">
              <option value="all">All sources</option>
              {(Object.keys(LEAD_SOURCE_LABEL) as LeadSource[]).map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input h-10 w-auto cursor-pointer text-[13px] font-medium">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="value">Highest value</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</StatusChip>
            {LEAD_STATUS_ORDER.map((s) => (
              <StatusChip key={s} active={statusFilter === s} dot={STATUS_META[s].dot} onClick={() => setStatusFilter(s)}>
                {LEAD_STATUS_LABEL[s]}
              </StatusChip>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <NoResults
              title="No leads match"
              body="No enquiries fit your current search and filters. Clear them to see your whole pipeline."
              onClear={() => {
                setQuery("");
                setStatusFilter("all");
                setSourceFilter("all");
              }}
            />
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              <div className="divide-y divide-line">
                {filtered.map((l) => (
                  <LeadRow key={l.id} lead={l} onOpen={() => setSelectedId(l.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <LeadForm
          lead={editing}
          onClose={() => setFormOpen(false)}
          onSave={saveForm}
        />
      )}

      {selected && (
        <LeadDrawer
          lead={selected}
          api={leadsApi}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onEdit={() => openEdit(selected)}
          onConverted={(custId) => { setSelectedId(null); navigate(`/customers/${custId}`); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const ACCENT: Record<string, string> = { brand: "text-brand-500", violet: "text-violet", warning: "text-warning", success: "text-success", ink: "text-ink3" };

function Kpi({ icon: Icon, accent, label, value }: { icon: typeof Users; accent: keyof typeof ACCENT; label: string; value: string }) {
  return (
    <div className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", ACCENT[accent])} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 font-display text-[23px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
    </div>
  );
}

function ChartBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] font-medium text-ink3">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function MiniEmpty() {
  return <div className="flex h-[210px] items-center justify-center text-[12.5px] text-ink3">No data yet</div>;
}

function StatusBar({ byStatus, total }: { byStatus: { status: LeadStatus; count: number }[]; total: number }) {
  const active = byStatus.filter((s) => s.count > 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line2">
        {active.map((s) => (
          <div key={s.status} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: STATUS_META[s.status].color }} title={`${LEAD_STATUS_LABEL[s.status]}: ${s.count}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {byStatus.map((s) => (
          <div key={s.status} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", STATUS_META[s.status].dot)} />
            <span className="text-[12px] text-ink2">{LEAD_STATUS_LABEL[s.status]}</span>
            <span className="text-[12px] font-semibold tnum text-ink">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ active, dot, onClick, children }: { active: boolean; dot?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-[color,background-color,box-shadow] duration-150",
        active ? "bg-brand-500/12 text-brand-500 ring-1 ring-inset ring-brand-500/25" : "text-ink3 hover:bg-line2 hover:text-ink"
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn("inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset", STATUS_META[status].chip)}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

function LeadRow({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="cv-row group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-panel2/60">
      <span className={cn("h-2 w-2 flex-none rounded-full", STATUS_META[lead.status].dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-ink">{lead.name}</span>
          <StatusBadge status={lead.status} />
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink3">
          {[lead.vehicle, lead.service].filter(Boolean).join(" · ") || lead.phone || lead.email || "No details"}
        </div>
      </div>
      <div className="hidden text-right sm:block">
        {lead.estimated_value != null && <div className="font-display text-[14px] font-bold tnum text-ink">{money(lead.estimated_value)}</div>}
        {lead.source && <div className="text-[11px] text-ink3">{LEAD_SOURCE_LABEL[lead.source as LeadSource] ?? lead.source}</div>}
      </div>
      <ChevronRight className="h-4 w-4 flex-none text-ink3 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slide-out detail drawer
// ---------------------------------------------------------------------------

function LeadDrawer({ lead, api, canManage, onClose, onEdit, onConverted }: {
  lead: Lead;
  api: ReturnType<typeof useLeads>;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onConverted: (customerId: string) => void;
}) {
  const { activities, addNote, reload } = useLeadActivities(lead.id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changeStatus = async (s: LeadStatus) => { await api.setStatus(lead.id, s); reload(); };

  const submitNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await addNote(note.trim()); setNote(""); } finally { setBusy(false); }
  };

  const convert = async () => {
    if (lead.converted_customer_id) { onConverted(lead.converted_customer_id); return; }
    if (!(await confirm({ title: `Convert ${lead.name} into a customer?`, body: "They'll be added to your customer book so you can book jobs and invoice them.", confirmLabel: "Convert to customer" }))) return;
    setBusy(true);
    try { const id = await api.convertToCustomer(lead); toast.success(`${lead.name} is now a customer`); onConverted(id); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const del = async () => {
    if (!(await confirm({ title: `Delete ${lead.name}?`, body: "This removes the lead and its activity history.", confirmLabel: "Delete lead", tone: "danger" }))) return;
    try { await api.remove(lead.id); toast.success("Lead deleted"); onClose(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-carbon-950/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="surface surface-raised relative flex h-full w-full max-w-[460px] flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-[14px] font-bold uppercase text-white shadow-glow">
            {lead.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-[18px] font-bold tracking-tight text-ink">{lead.name}</h2>
              <StatusBadge status={lead.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink3">
              {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-brand-500"><Phone className="h-3 w-3" />{lead.phone}</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-brand-500"><Mail className="h-3 w-3" />{lead.email}</a>}
            </div>
          </div>
          <IconBtn label="Close" onClick={onClose}><XIcon className="h-4 w-4" /></IconBtn>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <button onClick={convert} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-3 text-[12.5px] font-semibold text-white shadow-glow transition hover:shadow-glow-lg active:scale-95 disabled:opacity-50">
            <UserPlus className="h-3.5 w-3.5" /> {lead.converted_customer_id ? "View customer" : "Convert to customer"}
          </button>
          <button onClick={onEdit} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {canManage && (
            <IconBtn label="Delete lead" danger onClick={del}><Trash2 className="h-4 w-4" /></IconBtn>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Detail icon={Car} label="Vehicle" value={lead.vehicle} />
            <Detail icon={Wrench} label="Service" value={lead.service} />
            <Detail icon={DollarSign} label="Est. value" value={lead.estimated_value != null ? money(lead.estimated_value) : null} />
            <Detail icon={Users} label="Source" value={lead.source ? (LEAD_SOURCE_LABEL[lead.source as LeadSource] ?? lead.source) : null} />
            <Detail icon={CalendarDays} label="Created" value={fmtDate(lead.created_at)} />
            <Detail icon={Clock} label="Last contacted" value={whenLabel(lead.last_contacted_at)} />
          </div>

          {/* Status changer */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Move to</div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUS_ORDER.map((s) => (
                <button
                  key={s} onClick={() => changeStatus(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
                    lead.status === s ? STATUS_META[s].chip : "text-ink3 ring-line hover:bg-line2 hover:text-ink"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
                  {LEAD_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {lead.notes && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Notes</div>
              <p className="whitespace-pre-wrap rounded-xl bg-panel2/50 px-3.5 py-3 text-[13px] leading-relaxed text-ink2 ring-1 ring-inset ring-line">{lead.notes}</p>
            </div>
          )}

          {/* Activity */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Activity</div>
            <div className="flex items-start gap-2">
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }}
                placeholder="Add a note…"
                className="input flex-1"
              />
              <button onClick={submitNote} disabled={busy || !note.trim()} className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-lg bg-brand-500 text-white transition hover:brightness-105 active:scale-95 disabled:opacity-40">
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {activities.length === 0 ? (
                <div className="text-[12.5px] text-ink3">No activity yet.</div>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="flex gap-2.5">
                    <div className="mt-1 flex flex-col items-center">
                      <span className={cn("h-2 w-2 rounded-full", a.type === "note" ? "bg-brand-500" : a.type === "converted" ? "bg-success" : "bg-ink3")} />
                      <span className="mt-1 w-px flex-1 bg-line" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="text-[12.5px] leading-snug text-ink2">{a.body}</div>
                      <div className="mt-0.5 text-[11px] text-ink3">{new Date(a.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink3"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 text-[13.5px] font-semibold text-ink">{value || <span className="font-normal text-ink3">—</span>}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

function LeadForm({ lead, onClose, onSave }: { lead: Lead | null; onClose: () => void; onSave: (i: LeadInput) => Promise<void> }) {
  const [form, setForm] = useState<LeadInput>(
    lead
      ? {
          name: lead.name, phone: lead.phone ?? "", email: lead.email ?? "", vehicle: lead.vehicle ?? "",
          service: lead.service ?? "", estimated_value: lead.estimated_value, source: lead.source ?? "facebook",
          status: lead.status, notes: lead.notes ?? "",
        }
      : EMPTY_FORM
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<LeadInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        estimated_value: form.estimated_value === null || form.estimated_value === undefined || (form.estimated_value as unknown as string) === "" ? null : Number(form.estimated_value),
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={lead ? "Edit lead" : "Add lead"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>{busy ? "Saving…" : "Save lead"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Jane Doe" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className="input" value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="(214) 555-0134" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="jane@example.com" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vehicle">
            <input className="input" value={form.vehicle ?? ""} onChange={(e) => set({ vehicle: e.target.value })} placeholder="2021 Tesla Model 3" />
          </Field>
          <Field label="Requested service">
            <input className="input" value={form.service ?? ""} onChange={(e) => set({ service: e.target.value })} placeholder="Full interior detail" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Est. value">
            <input className="input" type="number" min={0} value={form.estimated_value ?? ""} onChange={(e) => set({ estimated_value: e.target.value === "" ? null : Number(e.target.value) })} placeholder="250" />
          </Field>
          <Field label="Source">
            <select className="input" value={form.source ?? "facebook"} onChange={(e) => set({ source: e.target.value })}>
              {(Object.keys(LEAD_SOURCE_LABEL) as LeadSource[]).map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status ?? "new"} onChange={(e) => set({ status: e.target.value as LeadStatus })}>
              {LEAD_STATUS_ORDER.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything useful to remember…" />
        </Field>
        {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}
