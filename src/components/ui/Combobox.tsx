import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ComboOption = {
  value: string;
  /** Trigger display text + primary search text. */
  label: string;
  /** Extra text folded into search (make, model, plate, category…). */
  keywords?: string;
  disabled?: boolean;
};

type Pos = { left: number; width: number; top?: number; bottom?: number; maxH: number };

/**
 * A polished, accessible select/combobox. The menu is portalled to <body> and
 * positioned against the trigger's rect so it never gets clipped by a scrolling
 * modal body (see "fixed overlays need portals"). Supports search, keyboard
 * navigation, custom row rendering, and an optional clear button.
 */
export function Combobox<T extends ComboOption>({
  value, onChange, options,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search…",
  disabled = false,
  invalid = false,
  clearable = false,
  ariaLabel,
  id,
  leading,
  emptyLabel = "No options",
  noMatchLabel = "No matches",
  renderOption,
  renderValue,
}: {
  value: string;
  onChange: (value: string) => void;
  options: T[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
  id?: string;
  leading?: ReactNode;
  emptyLabel?: string;
  noMatchLabel?: string;
  renderOption?: (o: T, selected: boolean) => ReactNode;
  renderValue?: (o: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => `${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Position the menu against the trigger; flip above when there's more room up.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const below = vh - r.bottom;
    const above = r.top;
    const cap = 300;
    const up = below < Math.min(cap, 240) && above > below;
    setPos({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? vh - r.top + 6 : undefined,
      maxH: Math.max(140, Math.min(cap, (up ? above : below) - 14)),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus search (or the list) on open; reset highlight to the selected row.
  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const idx = Math.max(0, filtered.findIndex((o) => o.value === value));
    setHi(idx === -1 ? 0 : idx);
    const t = window.setTimeout(() => {
      (searchable ? searchRef.current : menuRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlight in range as the filtered set shrinks; scroll it into view.
  useEffect(() => { setHi((h) => Math.min(h, Math.max(0, filtered.length - 1))); }, [filtered.length]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  // Dismiss on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (o: T) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[hi];
      if (o) choose(o);
    } else if (e.key === "Escape") {
      // Consume it: closing the open menu must not also close a parent Modal.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      // Let focus move natively, but don't let a parent focus-trap also react.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[10px] border bg-panel2 px-3 text-left text-[14px] text-ink",
          "shadow-[inset_0_1px_2px_rgb(16_22_38_/_0.03)] transition-[border-color,box-shadow] duration-150",
          "focus:outline-none focus-visible:border-brand-500 focus-visible:shadow-[0_0_0_3px_rgb(46_123_255_/_0.16)]",
          "max-sm:h-11 max-sm:text-[16px] disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-brand-500 shadow-[0_0_0_3px_rgb(46_123_255_/_0.16)]",
          invalid && !open ? "border-danger/60" : "border-line",
          !disabled && !open && "hover:border-ink3/55",
        )}
      >
        {leading && <span className="flex-none text-ink3">{leading}</span>}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ink3")}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
        </span>
        {clearable && selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="flex h-5 w-5 flex-none items-center justify-center rounded text-ink3 hover:bg-line2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={cn("h-4 w-4 flex-none text-ink3 transition-transform duration-150", open && "rotate-180")} />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKey}
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
          }}
          className="surface surface-raised z-[60] flex flex-col overflow-hidden rounded-xl p-1 outline-none animate-fade-up"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
              <Search className="h-4 w-4 flex-none text-ink3" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
              />
            </div>
          )}
          <div ref={listRef} className="scrollbar-slim flex flex-col overflow-y-auto py-1" style={{ maxHeight: pos.maxH }}>
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-ink3">{emptyLabel}</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-ink3">{noMatchLabel}</div>
            ) : (
              filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    data-idx={i}
                    disabled={o.disabled}
                    onClick={() => choose(o)}
                    onMouseMove={() => setHi(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      i === hi ? "bg-brand-500/10 text-ink" : "text-ink2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {renderOption ? renderOption(o, isSel) : <span className="truncate">{o.label}</span>}
                    </span>
                    {isSel && <Check className="h-4 w-4 flex-none text-brand-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
