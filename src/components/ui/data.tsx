import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 disabled:opacity-40 disabled:pointer-events-none ${
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-line2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Loading() {
  return (
    <div className="animate-fade flex h-[40vh] items-center justify-center [animation-delay:120ms]">
      <Loader2 className="h-6 w-6 animate-spin text-ink3" />
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
