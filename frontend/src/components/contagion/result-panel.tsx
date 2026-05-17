"use client";

import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { displayAccountLabel, formatMoneyCompact, formatLoss } from "@/lib/format";
import type { CascadeResult } from "@/types/api";

interface Props {
  result: CascadeResult | null;
  error: string | null;
}

export default function ResultPanel({ result, error }: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-xs text-rose-700 font-mono leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("contagion.result.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("contagion.result.title")}
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={t("contagion.result.breachedCount")}
          value={String(result.breached_count)}
          tone={result.breached_count > 0 ? "rose" : "neutral"}
        />
        <Metric
          label={t("contagion.result.totalLoss")}
          value={`$${formatMoneyCompact(result.total_loss_usd, intl)}`}
          tone="rose"
        />
        <Metric
          label={t("contagion.result.affectedCount")}
          value={String(result.affected.length)}
          tone="neutral"
        />
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {result.affected.map((hop) => (
          <div
            key={hop.account_id}
            className={`rounded-lg p-2 border ${
              hop.breached
                ? "bg-rose-50 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-semibold">
                {displayAccountLabel(hop.account_id)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-1.5 py-0.5 rounded bg-slate-200">
                  {t("contagion.result.hopBadge", { n: hop.hops_from_shock })}
                </span>
                {hop.breached && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 border border-rose-500/30">
                    {t("contagion.node.breached")}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <Stat
                label={t("contagion.result.loss")}
                value={formatLoss(hop.incoming_loss_usd, intl)}
                tone={hop.incoming_loss_usd > 0 ? "rose" : "neutral"}
              />
              <Stat
                label={t("contagion.result.postBalance")}
                value={`$${formatMoneyCompact(hop.post_shock_balance_usd, intl)}`}
                tone={hop.breached ? "rose" : "neutral"}
              />
              <Stat
                label={t("contagion.result.minBalance")}
                value={`$${formatMoneyCompact(hop.min_balance_usd, intl)}`}
                tone="neutral"
              />
            </div>
            {hop.contributors.length > 0 && (
              <p
                className="text-[10px] font-mono text-muted-foreground mt-1 truncate"
                title={hop.contributors.join(", ")}
              >
                via {hop.contributors.map(displayAccountLabel).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "neutral";
}) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm font-bold tabular-nums ${
          tone === "rose" ? "text-rose-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "neutral";
}) {
  return (
    <div>
      <div className="text-muted-foreground uppercase tracking-widest text-[8px]">
        {label}
      </div>
      <div
        className={`tabular-nums font-semibold ${
          tone === "rose" ? "text-rose-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
