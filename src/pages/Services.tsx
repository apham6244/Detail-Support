import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, Clock, Search, Wrench, Armchair, Droplets, Disc3,
  ShieldCheck, Sparkles, MoreHorizontal, Copy, Archive, ArchiveRestore,
  DollarSign, Layers, CheckCircle2, Flame, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { EmptyState, NoResults, SignInPrompt, money } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { useServices, type ServiceInput } from "@/hooks/useServices";
import { useAppointments } from "@/hooks/useAppointments";
import type { Service } from "@/lib/models";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Category taxonomy
//
// The `category` column is free text and already holds whatever a shop typed,
// so we never rewrite it. Known values are matched loosely (case-insensitive,
// keyword based) to get an icon + colour; anything else keeps its own group so
// existing data is preserved rather than swept into "Other".
// ---------------------------------------------------------------------------

type Tone = "violet" | "brand" | "amber" | "success" | "ink";
const TONE: Record<Tone, { bubble: string; chip: string; text: string }> = {
  violet:  { bubble: "bg-violet/12 text-violet",       chip: "bg-violet/12 text-violet ring-violet/25",       text: "text-violet" },
  brand:   { bubble: "bg-brand-500/12 text-brand-500", chip: "bg-brand-500/12 text-brand-500 ring-brand-500/25", text: "text-brand-500" },
  amber:   { bubble: "bg-warning/12 text-warning",     chip: "bg-warning/12 text-warning ring-warning/25",     text: "text-warning" },
  success: { bubble: "bg-success/12 text-success",     chip: "bg-success/12 text-success ring-success/25",     text: "text-success" },
  ink:     { bubble: "bg-line2 text-ink3",             chip: "bg-line2 text-ink3 ring-line",                   text: "text-ink3" },
};

const KNOWN: { label: string; icon: LucideIcon; tone: Tone; match: RegExp }[] = [
  { label: "Interior",        icon: Armchair,    tone: "violet",  match: /interior|cabin|upholster/i },
  { label: "Exterior",        icon: Droplets,    tone: "brand",   match: /exterior|wash|detail/i },
  { label: "Paint Correction",icon: Disc3,       tone: "amber",   match: /correct|polish|compound|swirl/i },
  { label: "Protection",      icon: ShieldCheck, tone: "success", match: /protect|ceramic|coat|seal|wax/i },
  { label: "Add-ons",         icon: Sparkles,    tone: "ink",     match: /add.?on|extra|upgrade/i },
];
/** Suggested values offered in the form — not enforced on the data. */
const SUGGESTED = KNOWN.map((k) => k.label);

function categoryMeta(raw: string | null) {
  const value = (raw ?? "").trim();
  if (!value) return { label: "Uncategorized", icon: Wrench, tone: "ink" as Tone, order: 99 };
  const hit = KNOWN.find((k) => k.match.test(value));
  if (hit) return { label: hit.label, icon: hit.icon, tone: hit.tone, order: KNOWN.indexOf(hit) };
  // Unrecognised but real — keep the shop's own label, styled neutrally.
  return { label: value, icon: Wrench, tone: "brand" as Tone, order: 50 };
}

const BLANK: ServiceInput = { name: "", price: 0, duration_min: 60, category: "", description: "", active: true };

const durationLabel = (min: number) => {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export default function Services() {
  const { services, loading, ready, create, update, remove } = useServices();
  const { appointments } = useAppointments();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceInput>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  // Bookings per service name — read-only, derived from existing appointments.
  const bookings = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appointments) {
      const n = a.service?.name;
      if (n) m.set(n, (m.get(n) ?? 0) + 1);
    }
    return m;
  }, [appointments]);

  const stats = useMemo(() => {
    const active = services.filter((s) => s.active !== false);
    const avg = active.length ? active.reduce((sum, s) => sum + s.price, 0) / active.length : 0;
    let popular: { name: string; count: number } | null = null;
    for (const s of services) {
      const count = bookings.get(s.name) ?? 0;
      if (count > 0 && (!popular || count > popular.count)) popular = { name: s.name, count };
    }
    return { total: services.length, active: active.length, avg, popular };
  }, [services, bookings]);

  const archivedCount = services.filter((s) => s.active === false).length;

  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return services.filter((s) => {
      if (!showArchived && s.active === false) return false;
      if (catFilter !== "all" && categoryMeta(s.category).label !== catFilter) return false;
      if (q && !`${s.name} ${s.category ?? ""} ${s.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, deferredQuery, catFilter, showArchived]);

  /** Group the visible services under their category, in a sensible order. */
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; icon: LucideIcon; tone: Tone; order: number; items: Service[] }>();
    for (const s of visible) {
      const meta = categoryMeta(s.category);
      const g = map.get(meta.label) ?? { ...meta, items: [] };
      g.items.push(s);
      map.set(meta.label, g);
    }
    return [...map.values()]
      .map((g) => ({ ...g, items: g.items.slice().sort((a, b) => b.price - a.price) }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [visible]);

  const categoryOptions = useMemo(() => {
    const set = new Map<string, number>();
    for (const s of services) {
      if (!showArchived && s.active === false) continue;
      const l = categoryMeta(s.category).label;
      set.set(l, (set.get(l) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [services, showArchived]);

  const openNew = () => { setEditing(null); setForm(BLANK); setError(null); setOpen(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name, price: s.price, duration_min: s.duration_min,
      category: s.category ?? "", description: s.description ?? "", active: s.active !== false,
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) await update(editing.id, form);
      else await create(form);
      setOpen(false);
      toast.success(editing ? "Service updated" : "Service added");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (s: Service) => {
    await create({
      name: `${s.name} (copy)`, price: s.price, duration_min: s.duration_min,
      category: s.category, description: s.description, active: s.active !== false,
    });
  };

  const toggleArchive = async (s: Service) => update(s.id, { active: s.active === false });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Services"
        subtitle="Your service menu — what you offer, what it costs, how long it takes"
        actions={ready ? <Button variant="primary" icon={<Plus />} onClick={openNew}>Add service</Button> : undefined}
      />

      {!ready ? (
        <SignInPrompt what="service catalog" />
      ) : loading ? (
        <PageSkeleton variant="cards" kpis={4} header={false} />
      ) : services.length === 0 ? (
        <EmptyState
          art="spray"
          title="No services yet"
          body="Add the services you offer — full detail, interior, ceramic coating — with pricing and duration."
          action={<Button variant="primary" icon={<Plus />} onClick={openNew}>Add your first service</Button>}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat index={0} icon={Layers} tone="brand" label="Total services" value={stats.total} />
            <Stat index={1} icon={CheckCircle2} tone="success" label="Active services" value={stats.active}
              sub={archivedCount ? `${archivedCount} archived` : "all live"} />
            <Stat index={2} icon={DollarSign} tone="amber" label="Average price" value={stats.avg} isMoney sub="across active services" />
            <Stat index={3} icon={Flame} tone="violet" label="Most popular"
              text={stats.popular?.name ?? "—"}
              sub={stats.popular ? `${stats.popular.count} booking${stats.popular.count === 1 ? "" : "s"}` : "no bookings yet"} />
          </div>

          {/* Toolbar */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…" className="input h-11 rounded-xl pl-9" />
            </div>
            {archivedCount > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold ring-1 ring-inset transition",
                  showArchived ? "bg-brand-500/10 text-brand-500 ring-brand-500/30" : "text-ink2 ring-line hover:bg-line2"
                )}
              >
                <Archive className="h-4 w-4" />
                {showArchived ? "Showing archived" : `Archived (${archivedCount})`}
              </button>
            )}
          </div>

          {categoryOptions.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip active={catFilter === "all"} onClick={() => setCatFilter("all")} count={visible.length}>All</Chip>
              {categoryOptions.map(([label, count]) => (
                <Chip key={label} active={catFilter === label} onClick={() => setCatFilter(label)} count={count}>
                  {label}
                </Chip>
              ))}
            </div>
          )}

          {/* Grouped cards */}
          {visible.length === 0 ? (
            <NoResults
              title="No services match"
              body="Nothing fits your current search and category. Clear them to see everything on your menu."
              onClear={() => {
                setQuery("");
                setCatFilter("all");
              }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-8">
              {groups.map((g) => (
                <section key={g.label}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={cn("flex h-8 w-8 flex-none items-center justify-center rounded-xl", TONE[g.tone].bubble)}>
                      <g.icon className="h-4 w-4" />
                    </span>
                    <h2 className="font-display text-[16px] font-bold tracking-tight text-ink">{g.label}</h2>
                    <span className="text-[12px] font-medium text-ink3">
                      {g.items.length} {g.items.length === 1 ? "service" : "services"}
                    </span>
                  </div>
                  <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                    {g.items.map((s, i) => (
                      <ServiceCard
                        key={s.id} service={s} index={i} tone={g.tone} icon={g.icon}
                        bookings={bookings.get(s.name) ?? 0}
                        isPopular={stats.popular?.name === s.name}
                        onEdit={() => openEdit(s)}
                        onDuplicate={() => duplicate(s)}
                        onArchive={() => toggleArchive(s)}
                        onDelete={async () => {
                          if (await confirm({ title: `Delete “${s.name}”?`, body: "This service is removed from your menu. Past jobs that used it are unaffected.", confirmLabel: "Delete service", tone: "danger" })) {
                            try { await remove(s.id); toast.success("Service deleted"); } catch (e) { toast.error((e as Error).message); }
                          }
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit service" : "Add service"}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add service"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Service name">
            <input className="input" value={form.name} autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Detail" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price ($)">
              <input className="input tnum" type="number" min={0} step="0.01" value={form.price ?? 0}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </Field>
            <Field label="Duration (min)">
              <input className="input tnum" type="number" min={0} step="5" value={form.duration_min ?? 60}
                onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} />
            </Field>
          </div>

          <Field label="Category">
            <input className="input" value={form.category ?? ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Interior · Exterior · Protection" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED.map((c) => {
                const on = (form.category ?? "").trim().toLowerCase() === c.toLowerCase();
                return (
                  <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset transition",
                      on ? "bg-brand-500/12 text-brand-500 ring-brand-500/30" : "text-ink3 ring-line hover:bg-line2 hover:text-ink"
                    )}>
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Description">
            <textarea className="input" rows={3} value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included" />
          </Field>

          {/* Live preview — how the card will read on the menu */}
          <div className="rounded-xl bg-panel2/50 px-3.5 py-3 ring-1 ring-inset ring-line/60">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">Preview</div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate font-display text-[15px] font-bold text-ink">{form.name.trim() || "Service name"}</span>
              <span className="font-display text-[17px] font-bold tnum text-ink">{money(Number(form.price) || 0)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink3">
              <Clock className="h-3 w-3" /> {durationLabel(Number(form.duration_min) || 0)}
              {form.category?.trim() && <><span className="text-line2">·</span>{form.category.trim()}</>}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.active !== false}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-[#2E7BFF]" />
            <span className="text-[13px] text-ink2">
              Active — show on the menu and when booking
            </span>
          </label>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stat({ index, icon: Icon, tone, label, value, text, sub, isMoney }: {
  index: number; icon: LucideIcon; tone: Tone; label: string;
  value?: number; text?: string; sub?: string; isMoney?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="surface group relative overflow-hidden rounded-[18px] p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-paint-gloss opacity-40" />
      <div className="relative flex items-center gap-3">
        <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", TONE[tone].bubble)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">{label}</div>
          {text !== undefined ? (
            <div className="mt-0.5 truncate font-display text-[17px] font-bold leading-tight tracking-tight text-ink">{text}</div>
          ) : (
            <CountUp
              value={value ?? 0}
              format={isMoney ? (n) => money(n) : (n) => String(Math.round(n))}
              className="mt-0.5 block font-display text-[20px] font-bold leading-none tracking-tight tnum text-ink"
            />
          )}
          {sub && <div className="mt-1 truncate text-[11px] text-ink3">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

function Chip({ active, onClick, count, children }: {
  active: boolean; onClick: () => void; count?: number; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97]",
        active ? "bg-brand-500 text-white shadow-glow" : "text-ink3 ring-1 ring-inset ring-line hover:bg-line2 hover:text-ink"
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tnum text-[11px] font-bold", active ? "text-white/80" : "text-ink3")}>{count}</span>
      )}
    </button>
  );
}

function ServiceCard({
  service: s, index, tone, icon: Icon, bookings, isPopular,
  onEdit, onDuplicate, onArchive, onDelete,
}: {
  service: Service; index: number; tone: Tone; icon: LucideIcon;
  bookings: number; isPopular: boolean;
  onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const archived = s.active === false;

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface group relative flex flex-col overflow-hidden rounded-[18px] p-4",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift hover:border-brand-500/40",
        archived && "opacity-70"
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-paint-gloss opacity-30" />

      {/* Head: icon + name + price */}
      <div className="relative flex items-start gap-3">
        <span className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", TONE[tone].bubble)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-display text-[15.5px] font-bold leading-snug tracking-tight text-ink">{s.name}</h3>
            {isPopular && !archived && (
              <span className="inline-flex flex-none items-center gap-1 rounded-full bg-warning/12 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.04em] text-warning ring-1 ring-inset ring-warning/25">
                <Flame className="h-3 w-3" /> Popular
              </span>
            )}
            {archived && (
              <span className="inline-flex flex-none items-center gap-1 rounded-full bg-line2 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.04em] text-ink3 ring-1 ring-inset ring-line">
                <Archive className="h-3 w-3" /> Archived
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink3">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{durationLabel(s.duration_min)}</span>
            {bookings > 0 && (
              <><span className="text-line2">·</span><span>{bookings} booked</span></>
            )}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="font-display text-[20px] font-bold leading-none tnum text-ink">{money(s.price)}</div>
        </div>
      </div>

      {s.description && (
        <p className="relative mt-3 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-ink3">{s.description}</p>
      )}

      {/* Actions */}
      <div className="relative mt-3.5 flex items-center gap-1.5 border-t border-line2 pt-3">
        <button
          onClick={onEdit}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-ink2 ring-1 ring-inset ring-line transition hover:bg-brand-500/10 hover:text-brand-500 hover:ring-brand-500/30 active:scale-95"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>

        <div className="relative ml-auto" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
            aria-label="More actions"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-[opacity,background-color,color] duration-150 hover:bg-line2 hover:text-ink",
              "opacity-100 md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100",
              menu && "opacity-100 bg-line2 text-ink"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.14 }}
              className="surface surface-raised absolute bottom-9 right-0 z-30 w-48 overflow-hidden rounded-xl py-1"
            >
              <MenuItem icon={Copy} onClick={onDuplicate}>Duplicate</MenuItem>
              <MenuItem icon={archived ? ArchiveRestore : Archive} onClick={onArchive}>
                {archived ? "Restore" : "Archive"}
              </MenuItem>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={Trash2} danger onClick={onDelete}>Delete</MenuItem>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: {
  icon: LucideIcon; children: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-ink2 hover:bg-line2 hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      {children}
    </button>
  );
}
