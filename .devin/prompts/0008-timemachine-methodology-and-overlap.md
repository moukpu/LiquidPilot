# Time Machine — round 4: methodology back, advisory out, footer doesn't overlap

**Repo:** https://github.com/moukpu/LiquidPilot
**Base branch:** `main` (HEAD = `6dff903` — последний docs-only мерж; код на этом SHA = состояние после `02857e9`. Если у тебя стрельнёт чем-то новее — `git fetch && git rebase origin/main`)
**Target PR title:** `chore(timemachine): restore methodology, drop no-breach advisory, fix footer overlap`

Три правки, всё фронт, бэкенд не трогаем. Это пост-фактум:
- 0006 вырезал «Методику» — owner это отменил (его фраза «убери всякие
  ненужные или объясняющие комментарии» имела в виду переименовать жаргон
  внутри методики, а не вырезать сам аккордеон). Возвращаем как было.
- Зелёная «Стресс прошёл — попробуй жёстче: bank_holiday 5d» плашка
  выглядит снисходительно и шумит. Убираем.
- На скрине из 9-карточной сетки видно, что в `FooterStat` числа двух
  соседних колонок сливаются («EUR 887 010EUR 351 973»). Currency
  префикс дублируется в каждой ячейке и переполняет узкие 280px-карточки.
  Убираем currency из ячейки — оно и так в `account_id` в шапке.

---

## Файлы

1. `frontend/src/components/timemachine/result-card.tsx`
2. `frontend/src/app/(dashboard)/timemachine/page.tsx`
3. `frontend/src/i18n/messages/en.ts`
4. `frontend/src/i18n/messages/ru.ts`

Бэкенд НЕ трогаем (методика приходит из API в `methodology_inputs` и так).

---

## Bug A — вернуть «Методику» (revert методологической части c198c57)

В коммите `c198c57` была удалена методология. Откатываем ровно те же
строки. Самый чистый способ — взять предыдущее состояние:

```bash
git show c198c57^:frontend/src/components/timemachine/result-card.tsx > /tmp/result-card-pre.tsx
```

Сравнить с текущим `result-card.tsx` и **добавить обратно**:

### A1. Импорт `MessageKey`

В начало файла, после `import { useLocale } from "@/i18n/locale-context";`:

```typescript
import type { MessageKey } from "@/i18n/messages/en";
```

### A2. Функция `translateReason`

Сразу после `formatStatAmount` (перед `interface Props`):

```typescript
function translateReason(
  raw: unknown,
  t: (k: MessageKey) => string
): string {
  const s = String(raw ?? "");
  if (s.includes("no inbound")) return t("timemachine.reason.noInboundOnRail");
  if (s.includes("no outbound")) return t("timemachine.reason.noOutboundOnRail");
  if (s.includes("country") && s.includes("not"))
    return t("timemachine.reason.countryMismatch");
  if (s.includes("multiplier")) return t("timemachine.reason.zeroMultiplier");
  return t("timemachine.reason.unknown");
}
```

### A3. JSX-блок `<details>` в карточке

Внутри `ResultCard`, **после** закрывающего `</div>` футер-грида (после
блока с `<FooterStat ... showSign />`), перед закрывающим `</div>` всей
карточки. То есть прямо перед последним `</div>` функции:

```tsx
      <details className="mt-2 group">
        <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground py-1 list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">
            ▸
          </span>
          {t("timemachine.methodologyLabel")}
        </summary>
        <div className="mt-1 p-2 rounded bg-card/50 border border-border/50 space-y-1">
          <MethodologyDetails
            inputs={result.methodology_inputs}
            currency={result.currency}
            intl={intl}
          />
        </div>
      </details>
```

### A4. Компоненты `MethodologyDetails` и `Row`

В **конец** файла, после функции `FooterStat`:

```tsx
function MethodologyDetails({
  inputs,
  currency,
  intl,
}: {
  inputs: Record<string, unknown>;
  currency: string;
  intl: IntlLocale;
}) {
  const { t } = useLocale();
  const scenario = inputs.scenario as string | undefined;

  if (inputs.applied === false) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        {t("timemachine.method.notApplied")}: {translateReason(inputs.reason, t)}
      </p>
    );
  }

  if (scenario === "rail_delay") {
    return (
      <>
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx · ${inputs.sample_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.avgInflow", { rail: String(inputs.rail) })}
          value={`${currency} ${formatNumber(Number(inputs.avg_daily_inflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.daysAffected")}
          value={String(inputs.days_affected)}
        />
        <Row
          label={t("timemachine.method.shiftPerDay")}
          value={`−${currency} ${formatNumber(Number(inputs.shift_per_day), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "volume_spike") {
    return (
      <>
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx · ${inputs.sample_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.avgOutflow", { rail: String(inputs.affected_rail) })}
          value={`${currency} ${formatNumber(Number(inputs.avg_daily_outflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.multiplier")}
          value={`×${Number(inputs.multiplier).toFixed(2)}`}
        />
        <Row
          label={t("timemachine.method.extraPerDay")}
          value={`−${currency} ${formatNumber(Number(inputs.extra_per_day), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "bank_holiday") {
    return (
      <>
        <Row
          label={t("timemachine.method.country")}
          value={`${String(inputs.country)} · ${inputs.holiday_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.dailyNetOutflow")}
          value={`${currency} ${formatNumber(Number(inputs.daily_net_outflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.deferred")}
          value={`−${currency} ${formatNumber(Number(inputs.deferred_outflow), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  return null;
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-[10px] font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          highlight ? "tabular-nums font-bold" : "tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
```

### A5. i18n ключи — вернуть всё, что c198c57 удалил

В `frontend/src/i18n/messages/en.ts` после `"timemachine.delta": "Delta",`
(точная позиция — там, где было, см. `git show c198c57 -- frontend/src/i18n/messages/en.ts`):

```typescript
  "timemachine.methodologyLabel": "Method",
  "timemachine.method.notApplied": "Not applied",
  "timemachine.method.sample": "Sample",
  "timemachine.method.days": "days",
  "timemachine.method.avgInflow": "Avg {rail} IN",
  "timemachine.method.avgOutflow": "Avg {rail} OUT",
  "timemachine.method.daysAffected": "Days affected",
  "timemachine.method.shiftPerDay": "Daily shift",
  "timemachine.method.multiplier": "Multiplier",
  "timemachine.method.extraPerDay": "Extra OUT/day",
  "timemachine.method.country": "Holiday",
  "timemachine.method.dailyNetOutflow": "Daily net outflow",
  "timemachine.method.deferred": "Deferred outflow",
```

И после блока `timemachine.hint.*`:

```typescript
  "timemachine.reason.noInboundOnRail": "no inbound transactions on this rail for this account",
  "timemachine.reason.noOutboundOnRail": "no outbound transactions on this rail for this account",
  "timemachine.reason.countryMismatch": "account country does not match holiday country",
  "timemachine.reason.zeroMultiplier": "multiplier ≤ 1 — no spike",
  "timemachine.reason.unknown": "scenario not applicable",
```

В `frontend/src/i18n/messages/ru.ts` зеркально:

```typescript
  "timemachine.methodologyLabel": "Методика",
  "timemachine.method.notApplied": "Не применимо",
  "timemachine.method.sample": "Выборка",
  "timemachine.method.days": "дн",
  "timemachine.method.avgInflow": "Средний приход {rail}",
  "timemachine.method.avgOutflow": "Средний отток {rail}",
  "timemachine.method.daysAffected": "Дней затронуто",
  "timemachine.method.shiftPerDay": "Сдвиг в день",
  "timemachine.method.multiplier": "Множитель",
  "timemachine.method.extraPerDay": "Доп. OUT/день",
  "timemachine.method.country": "Праздник",
  "timemachine.method.dailyNetOutflow": "Чистый отток/день",
  "timemachine.method.deferred": "Отложенный отток",
```

```typescript
  "timemachine.reason.noInboundOnRail": "по этому рельсу нет входящих транзакций для этого счёта",
  "timemachine.reason.noOutboundOnRail": "по этому рельсу нет исходящих транзакций для этого счёта",
  "timemachine.reason.countryMismatch": "страна счёта не совпадает со страной праздника",
  "timemachine.reason.zeroMultiplier": "множитель ≤ 1 — всплеска нет",
  "timemachine.reason.unknown": "сценарий неприменим",
```

**Важно:** точные русские строки можно подтвердить через
`git show c198c57 -- frontend/src/i18n/messages/ru.ts` — там были
ровно эти ключи с этими переводами до удаления.

---

## Bug B — убрать зелёную плашку «Стресс прошёл — попробуй жёстче»

### B1. JSX в `timemachine/page.tsx`

Удалить полностью этот блок (текущие строки ~106-112):

```tsx
{result.new_breach_count === 0 && (
  <div className="mb-4 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-emerald-700 text-xs leading-snug">
    {t("timemachine.summary.noBreaches", {
      suggestion: harderSuggestion(req),
    })}
  </div>
)}
```

После удаления оставшийся JSX начинается сразу с `<div className="grid gap-3" ...>`.

### B2. Функция `harderSuggestion`

В том же файле — удалить целиком (текущие строки ~143-154):

```tsx
function harderSuggestion(req: StressRequest): string {
  if (req.scenario === "rail_delay") {
    const next = Math.min(7, (req.extra_days ?? 1) + 2);
    return `rail_delay ${next}d`;
  }
  if (req.scenario === "volume_spike") {
    const next = Math.min(2.0, (req.multiplier ?? 1.3) + 0.3);
    return `multiplier ×${next.toFixed(2)}`;
  }
  const next = Math.min(5, (req.holiday_days ?? 2) + 1);
  return `bank_holiday ${next}d`;
}
```

После этого `StressRequest` импорт может стать неиспользуемым — если
TypeScript / ESLint так пожалуется, удалить `StressRequest` из строки
`import type { StressRequest, ... } from "@/types/api";` (но `StressResult`
и `StressScenario` оставить — они используются в стейте и `ScenarioHint`).

### B3. i18n ключ

В `frontend/src/i18n/messages/en.ts` удалить строку:

```typescript
"timemachine.summary.noBreaches": "Stress passed — no account drops below floor. Try harder: {suggestion}.",
```

В `frontend/src/i18n/messages/ru.ts` удалить строку:

```typescript
"timemachine.summary.noBreaches": "Стресс прошёл — ни один счёт не свалился под минимум. Попробуй жёстче: {suggestion}.",
```

---

## Bug C — currency пропадает из футер-ячейки

### C1. `FooterStat` в `result-card.tsx`

Текущий рендер (примерно строки 197-203):

```tsx
<div
  className={`tabular-nums text-right whitespace-nowrap text-[10px] ${tone}`}
  title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
>
  {sign}
  {currency} {formatStatAmount(amount, intl)}
</div>
```

⚠ **NB:** в 0007 этот рендер ДОЛЖЕН был получить `text-xs font-semibold`
и убранный `text-right`, fallback `text-foreground`. Если 0007 уже
смержен (commit `02857e9`) — оно уже там. Не возвращай эти классы назад.
Меняй ТОЛЬКО то, что про currency.

После правки (currency убрана из текста, но осталась в tooltip):

```tsx
<div
  className={`tabular-nums whitespace-nowrap text-xs font-semibold ${
    tone || "text-foreground"
  }`}
  title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
>
  {sign}
  {formatStatAmount(amount, intl)}
</div>
```

То есть из видимого текста выкидываем `{currency}` и пробел перед
суммой. Currency остаётся **только** в нативном `title`-тултипе на ховер.
Юзер видит сжатое число («887K» / «−535K»), а на ховер — точная сумма
с валютой («EUR −535 037»). Сам currency-код уже отображается в шапке
карточки как часть `account_id` («EUR-Main», «USD-LA», «KZT-Almaty»),
дублировать его трижды в футере не нужно.

### C2. (опционально) понизить порог компактного формата

В `formatStatAmount` (строки 7-14) порог сейчас 1 000 000 — для
small-currency аккаунтов вроде GBP-Local с `-4,92 млн` это нормально,
но для GBP-аккаунта со значением «887 010» (меньше миллиона) будет
полное число. Чтобы цифры стабильно влезали в 280px-карточку, понизь
порог до **100 000**:

```typescript
function formatStatAmount(amount: number, intl: IntlLocale): string {
  // Compact for absolute values ≥ 100k. Below that, three-digit values
  // are short enough to read without compacting.
  if (Math.abs(amount) >= 100_000) {
    return formatMoneyCompact(amount, intl);
  }
  return formatNumber(amount, 0, intl);
}
```

Если `formatMoneyCompact` уже умеет отдавать «887K» / «352K» — этого
достаточно. Если он работает только от 1M (и для 887 010 возвращает
полную строку), оставь старый порог 1 000 000 и при компиляции просто
удалить currency префикс (C1) — это уже сэкономит ~30% ширины ячейки.

---

## Чего НЕ делать

- Не трогать бэкенд.
- Не возвращать `auto-fit` (была отдельная правка `auto-fill` в 0006).
- Не менять цвета stress curve / delta / breach badge — это из 0007,
  всё работает.
- Не убирать `breachTooltip` и `legend.*` — это из 0007.
- Не пытаться «улучшить» лейблы внутри методики (Множитель, Сдвиг и т.д.).
  Owner явно сказал «верни методику и всё» — без переименования.
- Не использовать `@radix-ui/tooltip` или другие либы — нативный
  `title` атрибут уже работает.
- НИКАКИХ новых i18n ключей помимо реставрации удалённых в c198c57.
- Не править `formatMoneyCompact` в `lib/format.ts` (если он
  существует) — только использование в `formatStatAmount`.

---

## Acceptance

- `/timemachine`, запуск любого сценария → результат-карточки:
  1. Внизу карточки появилась клик-стрелка `▸ Методика` (русск.) /
     `▸ Method` (англ.). Клик → раскрывается панель с расчётом.
     Для аккаунтов где сценарий неприменим (например JPY-Tokyo при
     bank_holiday SG) — показывается `Не применимо: страна счёта
     не совпадает со страной праздника`.
  2. **НЕТ** зелёной плашки «Стресс прошёл — попробуй жёстче …» при
     `new_breach_count === 0`. Сетка карточек начинается сразу.
  3. В футере карточки три ячейки: «Базовый минимум», «Стрессовый
     минимум», «Дельта». Под каждым лейблом — число **без префикса
     валюты**. На ховер на число — `title` показывает полное значение
     с валютой и без сокращения.
  4. Числа двух соседних ячеек **больше не сливаются** на 280px
     карточке (главный визуальный баг со скрина).
- `npm run lint` — 0 ошибок и предупреждений.
- `npx tsc --noEmit` — 0 ошибок.
- `npm run build` — green, `/timemachine` route компилируется.
- `pytest backend/tests/` — 5 passed (бэкенд не тронут).

---

## PR title

`chore(timemachine): restore methodology, drop no-breach advisory, fix footer overlap`

В описании PR:
- before/after для Bug A (скрин: карточка без методики → карточка с
  раскрытым `▸ Method`)
- before/after для Bug B (скрин: зелёная плашка над сеткой → её нет)
- before/after для Bug C (скрин: «EUR 887 010 EUR 351 973» сливается →
  «887K   352K» с воздухом)
- 4 файла, ожидаемо +200/-15 строк (методика добавляется большим
  блоком, advisory и currency — мелкие удаления).
