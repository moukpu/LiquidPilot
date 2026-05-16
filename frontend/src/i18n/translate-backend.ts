import type { Alert, TransferSuggestion } from "@/types/api";
import { type Locale, localeToIntl } from "@/i18n/locale-context";
import { formatMoney } from "@/lib/format";
import en, { type MessageKey } from "@/i18n/messages/en";
import ru from "@/i18n/messages/ru";

const catalogs = { en, ru };

function pick(locale: Locale, key: MessageKey): string {
  const fromLocale = catalogs[locale][key];
  if (fromLocale) return fromLocale;
  return en[key];
}

function interp(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

export function translateBackendAlert(alert: Alert, locale: Locale): string {
  // Read structured fields directly from the Alert object — we never parse
  // the backend's `.message` string here because it's full of ML jargon
  // (P05, P50, "ledger balance") that no treasurer thinks in. The
  // user-facing templates are stored in the i18n catalogs.
  const intl = localeToIntl(locale);
  const templateKey: MessageKey =
    alert.severity === "CRITICAL"
      ? "alert.message.critical"
      : "alert.message.warning";
  return interp(pick(locale, templateKey), {
    account: alert.account_id,
    projected: formatMoney(
      alert.projected_balance,
      alert.currency,
      { fractionDigits: 0 },
      intl
    ),
    min: formatMoney(
      alert.min_balance,
      alert.currency,
      { fractionDigits: 0 },
      intl
    ),
    shortfall: formatMoney(
      alert.shortfall,
      alert.currency,
      { fractionDigits: 0 },
      intl
    ),
    date: alert.breach_date,
    days: alert.days_until_breach,
  });
}

export function translateBackendTransfer(
  t: TransferSuggestion,
  locale: Locale,
  severity: "CRITICAL" | "WARNING" | "INFO" = "CRITICAL"
): string {
  return interp(pick(locale, "backend.transfer.fund"), {
    to: t.to_account,
    severity: pick(locale, `severity.${severity}` as MessageKey),
    breachDate: t.initiate_by ?? "—",
    from:
      t.from_account === "(none)"
        ? locale === "ru"
          ? "внешнего источника"
          : "external funding"
        : t.from_account,
    rail: t.rail,
  });
}

