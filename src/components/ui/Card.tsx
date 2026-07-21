import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface overflow-hidden rounded-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-line px-[18px] py-4",
        className
      )}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h3>
        {subtitle && (
          <span className="text-[12.5px] font-medium text-ink3">{subtitle}</span>
        )}
      </div>
      {action && <div className="ml-auto flex items-center gap-3">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-[18px]", className)}>{children}</div>;
}
