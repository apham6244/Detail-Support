import { useEffect, useRef, useState } from "react";

/**
 * A number that animates up from 0 to its value on mount. Respects
 * prefers-reduced-motion (jumps straight to the value) and never runs for
 * zero/near-instant values. Pass a formatter for currency, percentages, etc.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 650,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [display, setDisplay] = useState(reduce || value === 0 ? value : 0);
  const raf = useRef<number>();

  useEffect(() => {
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, reduce]);

  return <span className={className}>{format(display)}</span>;
}
