import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * An image that always has a premium carbon gradient behind it. If the photo
 * fails to load (network, an expired CDN URL), the <img> hides itself and the
 * gradient remains — the layout never shows a broken tile. Add `overlay` to
 * darken the photo so overlaid text stays readable.
 */
export function DetailImage({
  src,
  alt,
  className,
  imgClassName,
  overlay = false,
  eager = false,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  overlay?: boolean | "strong";
  eager?: boolean;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    // A background-fill layer: absolutely fills its (relative) parent. The
    // carbon gradient is the base, so if the photo fails the parent still has a
    // premium surface instead of a broken tile.
    <div
      className={cn(
        "absolute inset-0 overflow-hidden bg-gradient-to-br from-[#0B0F17] via-[#141b29] to-[#0B0F17]",
        className
      )}
    >
      {!failed && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      )}
      {overlay && (
        <div
          className={cn(
            "absolute inset-0",
            overlay === "strong"
              ? "bg-gradient-to-t from-[#070A11]/95 via-[#070A11]/55 to-[#070A11]/25"
              : "bg-gradient-to-t from-[#070A11]/85 via-[#070A11]/30 to-transparent"
          )}
        />
      )}
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}
