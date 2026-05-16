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
  const intl = localeToIntl(locale);
  return interp(pick(locale, "backend.alert.template"), {
    accountId: alert.account_id,
    projected: formatMoney(
      alert.projected_balance,
      alert.currency,
      { fractionDigits: 0 },
      intl
    ),
    currency: alert.currency,
    breachDate: alert.breach_date,
    floor: formatMoney(
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

export function translateBackendNote(
  t: TransferSuggestion,
  locale: Locale
): string | null {
  if (t.from_account === "(none)") {
    return pick(locale, "backend.transfer.note.escalate");
  }
  if (t.requires_fx) {
    return interp(pick(locale, "backend.transfer.note.fx"), {
      fromCcy: t.currency_from,
      toCcy: t.currency_to,
    });
  }
  return null;
}
