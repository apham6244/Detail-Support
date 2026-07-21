import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, ArrowUpRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/data";
import { useEntitlements } from "@/lib/entitlements";
import { cn } from "@/lib/cn";

/**
 * Renders `children` only when the org's effective plan includes `feature`.
 * Otherwise shows an upgrade prompt naming the plan that unlocks it.
 *
 * This is a UX gate. The database (RLS + limit triggers) remains the real
 * security boundary — this never grants access the server would deny.
 */
export function UpgradeGate({
  feature,
  title,
  description,
  compact,
  children,
}: {
  feature: string;
  title: string;
  description: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const ent = useEntitlements();

  if (ent.loading) return compact ? null : <Loading />;
  if (ent.hasFeature(feature)) return <>{children}</>;

  return <FeatureLocked feature={feature} title={title} description={description} compact={compact} />;
}

export function FeatureLocked({
  feature,
  title,
  description,
  compact,
}: {
  feature: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  const ent = useEntitlements();
  const plan = ent.planForFeature(feature);
  const planName = plan?.name ?? "Pro";
  const price = plan ? `$${plan.monthlyPrice}/mo` : "";

  const cta = (
    <Link
      to="/billing"
      className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-4 text-[13px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98]"
    >
      <ArrowUpRight className="h-4 w-4" />
      Upgrade to {planName}
      {price && <span className="opacity-80">· {price}</span>}
    </Link>
  );

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-line px-4 py-6 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Lock className="h-[18px] w-[18px]" />
        </div>
        <div className="text-[13.5px] font-semibold">{title} is a {planName} feature</div>
        <div className="max-w-xs text-xs text-ink3">{description}</div>
        {cta}
      </div>
    );
  }

  return (
    <Card className="mx-auto mt-2 flex max-w-lg flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Lock className="h-7 w-7" />
        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>
      <div>
        <div className="text-[17px] font-bold">{title} is a {planName} feature</div>
        <div className={cn("mx-auto mt-1.5 max-w-sm text-[13.5px] text-ink3")}>{description}</div>
      </div>
      {cta}
      <Link to="/billing" className="text-[12.5px] font-semibold text-ink3 hover:text-brand-500">
        Compare plans
      </Link>
    </Card>
  );
}
