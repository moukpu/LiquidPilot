"use client";

import { ShieldCheck } from "lucide-react";
import { useT } from "@/i18n/locale-context";

export default function EmptyState() {
  const t = useT();
  const detail = t("empty.detail", { demo: "\u0000DEMO\u0000" });
  const [before, after] = detail.split("\u0000DEMO\u0000");
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
        <ShieldCheck className="relative w-12 h-12 text-emerald-400" />
      </div>
      <div className="text-base font-semibold">{t("empty.standingBy")}</div>
      <div className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">
        {before}
        <span className="font-mono text-primary">{t("autopilot.demoMode")}</span>
        {after}
      </div>
    </div>
  );
}
