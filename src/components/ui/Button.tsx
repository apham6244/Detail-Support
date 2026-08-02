import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  // Glossy brand button: a subtle top→bottom gradient (light on top), the shared
  // glow, and a hover that brightens + blooms. Colours are theme-independent.
  primary:
    "border-brand-600/60 bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-glow " +
    "hover:from-brand-400 hover:to-brand-500 hover:shadow-glow-lg active:from-brand-500 active:to-brand-600 " +
    "disabled:shadow-none",
  // Quiet surface button: hairline border, gentle inner highlight, hover fill.
  secondary:
    "border-line bg-panel text-ink shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_1px_2px_rgb(16_22_38_/_0.05)] " +
    "hover:border-ink3 hover:bg-panel2",
  ghost:
    "border-transparent bg-transparent text-ink2 hover:bg-line2 hover:text-ink",
};

export function Button({
  variant = "secondary",
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // 38px base; a 44px min-height on mobile keeps every button a comfortable
        // thumb target (min-h doesn't fight callers that set an explicit height).
        "inline-flex h-[38px] min-h-[44px] items-center justify-center gap-2 rounded-lg border px-[15px] text-[13px] font-semibold tracking-[0.01em] select-none md:min-h-0",
        // Smooth, springy micro-interactions: eased transitions + a tactile press.
        "transition-[transform,box-shadow,background-color,border-color,filter,color] duration-150 ease-out",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-ground",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </button>
  );
}
