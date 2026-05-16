"use client";

import { useT } from "@/i18n/locale-context";
import LocaleSwitcher from "@/components/locale-switcher";

export default function Topbar() {
  const t = useT();
  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-6 justify-between">
      <span className="text-sm text-muted-foreground">{t("topbar.dashboard")}</span>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          LP
        </div>
      </div>
    </header>
  );
}
