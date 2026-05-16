"use client";

import { useT } from "@/i18n/locale-context";

export default function TimeMachinePage() {
  const t = useT();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("stub.timemachine.title")}</h1>
      <p className="text-muted-foreground">{t("stub.timemachine.body")}</p>
    </div>
  );
}
