import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[26px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink3">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2.5 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
