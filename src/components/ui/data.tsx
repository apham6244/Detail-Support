import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, SearchX, RotateCcw } from "lucide-react";
import { Card } from "./Card";
import { EmptyArt, type EmptyArtVariant } from "./EmptyArt";

export const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Number(n).toFixed(2)}`;

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-line px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3 ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3.5 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}

export function IconBtn({
  children,
  onClick,
  label,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex h-10 w-10 items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 disabled:opacity-40 disabled:pointer-events-none md:h-8 md:w-8 ${
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-line2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * In-page loader. A brand-tinted ring rather than a grey spinner — the delayed
 * fade means quick loads never flash it at all.
 */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="animate-fade flex h-[40vh] flex-col items-center justify-center gap-3 [animation-delay:120ms]">
      <span className="relative flex h-10 w-10 items-center justify-center">
        {/* soft brand halo */}
        <span aria-hidden className="absolute inset-0 rounded-full bg-brand-500/15 blur-md motion-safe:animate-pulse" />
        {/* track + sweeping arc */}
        <span aria-hidden className="absolute inset-0 rounded-full border-2 border-line2" />
        <Loader2 className="relative h-[26px] w-[26px] animate-spin text-brand-500" strokeWidth={2.4} />
      </span>
      <span className="text-[12.5px] font-medium text-ink3">{label}…</span>
    </div>
  );
}

export function EmptyState({
  art = "car",
  icon,
  title,
  body,
  action,
}: {
  art?: EmptyArtVariant;
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      {icon ? (
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet/15 text-brand-500">
          <div className="absolute inset-0 rounded-2xl bg-paint-gloss opacity-40" />
          <span className="relative [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
        </div>
      ) : (
        <EmptyArt variant={art} />
      )}
      <div>
        <div className="font-display text-[17px] font-bold tracking-tight text-ink">{title}</div>
        <div className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink3">{body}</div>
      </div>
      {action}
    </Card>
  );
}

/**
 * Filtered / searched but nothing matched. Deliberately distinct from
 * `EmptyState`: the data *exists*, it's just hidden by a query or filter — so
 * the encouraging next move is "clear it and look again," never "add your
 * first…". A dashed frame signals "transient," and the Clear button is the one
 * clear action.
 */
export function NoResults({
  title = "No matches",
  body,
  onClear,
  clearLabel = "Clear filters",
}: {
  title?: string;
  body: string;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-line2 text-ink3">
        <SearchX className="h-[22px] w-[22px]" />
      </span>
      <div>
        <div className="font-display text-[14.5px] font-bold tracking-tight text-ink">{title}</div>
        <div className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-ink3">{body}</div>
      </div>
      {onClear && (
        <button
          onClick={onClear}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[12.5px] font-semibold text-ink2 transition-[transform,color,border-color] duration-150 ease-out hover:border-ink3/50 hover:text-ink active:scale-[0.97]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {clearLabel}
        </button>
      )}
    </div>
  );
}

/**
 * A compact "no data yet" state for a single widget/panel (not a whole page).
 * Warm gradient icon bubble + one encouraging line + optional inline action, so
 * a panel waiting for its first data point still feels alive, not unfinished.
 */
export function InlineEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet/15 text-brand-500">
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-paint-gloss opacity-40" />
        <span className="relative [&>svg]:h-[22px] [&>svg]:w-[22px]">{icon}</span>
      </span>
      <div>
        <div className="font-display text-[14px] font-bold tracking-tight text-ink">{title}</div>
        <div className="mx-auto mt-1 max-w-[17rem] text-[12.5px] leading-relaxed text-ink3">{body}</div>
      </div>
      {action}
    </div>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  return (
    <EmptyState
      art="key"
      title="Sign in to continue"
      body={`Sign in to manage your ${what}.`}
      action={
        <Link
          to="/login"
          className="inline-flex h-[38px] items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-4 text-[13px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98]"
        >
          Sign in
        </Link>
      }
    />
  );
}
