"use client";

import { useLocale } from "@/i18n/locale-context";

export default function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();

  const baseClass =
    "px-2 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider transition-colors";
  const activeClass = "bg-primary text-primary-foreground";
  const inactiveClass = "text-muted-foreground hover:text-foreground";

  return (
    <div
      role="group"
      aria-label={t("switcher.aria")}
      className="inline-flex items-center rounded-md border border-border overflow-hidden"
    >
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
        className={`${baseClass} ${locale === "en" ? activeClass : inactiveClass}`}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={locale === "ru"}
        onClick={() => setLocale("ru")}
        className={`${baseClass} ${locale === "ru" ? activeClass : inactiveClass}`}
      >
        RU
      </button>
    </div>
  );
}
