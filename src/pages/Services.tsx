import { useState } from "react";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import {
  IconBtn,
  Loading,
  EmptyState,
  SignInPrompt,
  money,
} from "@/components/ui/data";
import { useServices, type ServiceInput } from "@/hooks/useServices";
import type { Service } from "@/lib/models";

export default function Services() {
  const { services, loading, ready, create, update, remove } = useServices();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceInput>({ name: "", price: 0, duration_min: 60 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", price: 0, duration_min: 60, category: "", description: "" });
    setError(null);
    setOpen(true);
  };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      price: s.price,
      duration_min: s.duration_min,
      category: s.category ?? "",
      description: s.description ?? "",
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Services"
        subtitle="Your service catalog — pricing and duration"
        actions={
          ready ? (
            <Button variant="primary" icon={<Plus />} onClick={openNew}>
              Add service
            </Button>
          ) : undefined
        }
      />

      {!ready ? (
        <SignInPrompt what="service catalog" />
      ) : loading ? (
        <Loading />
      ) : services.length === 0 ? (
        <EmptyState
          art="spray"
          title="No services yet"
          body="Add the services you offer — full detail, interior, ceramic coating — with pricing."
          action={
            <Button variant="primary" icon={<Plus />} onClick={openNew}>
              Add your first service
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="surface gloss-card group flex flex-col rounded-2xl p-4 transition hover:border-brand-500/40 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {s.category && (
                    <span className="inline-flex rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500">
                      {s.category}
                    </span>
                  )}
                  <div className="mt-1.5 font-display text-[15px] font-bold leading-snug text-ink">{s.name}</div>
                </div>
                <div className="flex-none text-right">
                  <div className="font-display text-[19px] font-bold tnum leading-none text-ink">{money(s.price)}</div>
                </div>
              </div>

              {s.description && (
                <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-ink3">{s.description}</p>
              )}

              <div className="mt-3 flex items-center gap-2 border-t border-line2 pt-3">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink3">
                  <Clock className="h-3.5 w-3.5" /> {s.duration_min} min
                </span>
                <div className="ml-auto flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                  <IconBtn onClick={() => openEdit(s)} label="Edit">
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn onClick={() => remove(s.id)} label="Delete" danger>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit service" : "Add service"}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full Detail"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price ($)">
              <input
                className="input tnum"
                type="number"
                min={0}
                step="0.01"
                value={form.price ?? 0}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                className="input tnum"
                type="number"
                min={0}
                step="5"
                value={form.duration_min ?? 60}
                onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Category">
            <input
              className="input"
              value={form.category ?? ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Interior · Exterior · Ceramic"
            />
          </Field>
          <Field label="Description">
            <textarea
              className="input"
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's included"
            />
          </Field>
          {error && <div className="text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}
