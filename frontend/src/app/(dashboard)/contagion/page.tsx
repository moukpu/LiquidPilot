"use client";

import { useT } from "@/i18n/locale-context";

export default function ContagionPage() {
  const t = useT();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("stub.contagion.title")}</h1>
      <p className="text-muted-foreground">{t("stub.contagion.body")}</p>
    </div>
  );
}
