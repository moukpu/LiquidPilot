# Time Machine — readability round 3

**Repo:** https://github.com/moukpu/LiquidPilot
**Base branch:** `main` (HEAD будет `dd61793` или новее, см. ниже)
**Target PR title:** `chore(timemachine): readable card — stress curve color, footer alignment, breach tooltip`

ВАЖНО: эта правка ЛОЖИТСЯ ПОВЕРХ промпта `0006`. То есть к моменту мержа
этого PR:
- блок «Не затронуто счетов» уже удалён,
- grid `auto-fit` → `auto-fill` уже сделан,
- аккордеон «Методика» уже удалён вместе с `MethodologyDetails` / `Row` / `translateReason`.

Если 0006 ещё не смержен — дождись его, либо собери оба патча одной веткой
(но тогда укажи это в описании PR).

Все правки — фронт. Бэкенд не трогать.

---

## Bug A — стрессовая кривая сливается с базовой

**Файл:** `frontend/src/components/timemachine/result-card.tsx`

Сейчас в карточке две линии: серая baseline `#94a3b8` и серая stress
`#94a3b8` (когда `breachWorsened === false`). Различить их визуально
невозможно — owner буквально не понимает что это две кривые.

Owner-фидбек дословно: «нужно одну сделать другого цвета например
зеленый, это то как себя поведет при каикх то условиях, а серая
это по обычному, красная — это пробои».

Модель «3 визуальных состояния»:
- baseline → серая (статус-кво)
- stress без новых пробоев → зелёная (альтернативный сценарий)
- stress с новыми пробоями → красная (тревога)

### Действия

1) Заменить `stressColor`:

Сейчас:
```ts
const breachWorsened = result.stress_breaches > result.baseline_breaches;
const stressColor = breachWorsened ? "#dc2626" : "#94a3b8";
```

Стало:
```ts
const breachWorsened = result.stress_breaches > result.baseline_breaches;
// 3 visual states for the stress curve so it never overlaps with
// baseline: rose (breach worsened), emerald (no breach worsened),
// slate (not applicable to this account).
const stressColor = breachWorsened ? "#dc2626" : "#10b981";
```

Для `applied === false` ничего не меняется — там пунктирная серая
прямая `#cbd5e1`, она и так не overlap'ит с baseline.

Комментарий в коде про «No green: stress can never visually claim
improvement» — **удалить**. Owner-фидбек явно отменяет эту дизайн-
гипотезу.

2) Над всей сеткой карточек (в `frontend/src/app/(dashboard)/timemachine/page.tsx`)
добавить **одну** маленькую инлайн-легенду, **ровно ОДИН раз**, прямо
перед `<div className="grid gap-3" ...>`:

```tsx
<div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-2">
  <LegendDot color="#94a3b8" label={t("timemachine.legend.baseline")} />
  <LegendDot color="#10b981" label={t("timemachine.legend.stress")} />
  <LegendDot color="#dc2626" label={t("timemachine.legend.breach")} />
</div>
```

И мини-компонент в том же файле, ниже `ScenarioHint`:

```tsx
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-[2px] rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
```

i18n ключи в `en.ts` и `ru.ts`:
```ts
"timemachine.legend.baseline": "Базовый прогноз" / "Baseline",
"timemachine.legend.stress": "Под стрессом" / "Under stress",
"timemachine.legend.breach": "Пробой пола" / "Floor breach",
```

---

## Bug B — числа улетели вправо от лейблов

**Файл:** `frontend/src/components/timemachine/result-card.tsx`,
компонент `FooterStat` (строки ~201-237).

Сейчас лейбл `БАЗОВЫЙ МИНИМУМ` слева, а число `EUR 887 010` справа
внутри той же ячейки grid — выглядит как будто число оторвалось от
лейбла. Owner: «они не ровно под ними».

### Действие

Убрать `text-right` из дива с числом и поднять размер чтобы был
видимый контраст с лейблом. Также сделать число не-muted (сейчас
наследуется body color, но визуально читается как gray — выше яркости).

Было:
```tsx
return (
  <div className="min-w-0">
    <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
      {label}
    </div>
    <div
      className={`tabular-nums text-right whitespace-nowrap text-[10px] ${tone}`}
      title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
    >
      {sign}
      {currency} {formatStatAmount(amount, intl)}
    </div>
  </div>
);
```

Стало:
```tsx
return (
  <div className="min-w-0">
    <div className="text-muted-foreground uppercase tracking-widest text-[9px] mb-0.5">
      {label}
    </div>
    <div
      className={`tabular-nums whitespace-nowrap text-xs font-semibold ${tone || "text-foreground"}`}
      title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
    >
      {sign}
      {currency} {formatStatAmount(amount, intl)}
    </div>
  </div>
);
```

Изменения:
- `text-right` удалить → число лево-выравнено внутри ячейки, ровно под лейблом.
- `text-[10px]` → `text-xs` (12px).
- `font-semibold` добавить.
- Если `tone` пустой — fallback `text-foreground` (чтобы число
  не выглядело muted).
- `mb-0.5` на лейбле — крошечный воздух между лейблом и числом.

`tone` для delta остаётся прежним: rose-500 font-bold для negative.
Опционально: для baseline и stress подкрасить число лёгким оттенком
(slate-600 / emerald-700), но это можно НЕ делать если выглядит шумно.

---

## Bug C — «Что такое пробой?»

Owner спрашивает: «что значит пробои и что она делает». В UI слово
«ПРОБОЙ» появляется в трёх местах:
1. Бэйдж в правом верхнем углу карточки (`timemachine.breach`).
2. Стат «Новые пробои» в result-баре (`timemachine.newBreaches`).
3. Теперь ещё в новой легенде сверху (см. Bug A).

### Действие

1) Бэйдж в карточке — добавить `title` атрибут:

`frontend/src/components/timemachine/result-card.tsx`, в JSX где
рендерится бэйдж (рядом с `account_id`):

Было:
```tsx
{breachWorsened && (
  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30">
    {t("timemachine.breach")}
  </span>
)}
```

Стало:
```tsx
{breachWorsened && (
  <span
    className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-help"
    title={t("timemachine.breachTooltip")}
  >
    {t("timemachine.breach")}
  </span>
)}
```

2) Стат «Новые пробои» в result-баре `timemachine/page.tsx` — тоже
добавить `title` на родительский `<div>`:

Было:
```tsx
<div>
  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
    {t("timemachine.newBreaches")}
  </div>
  ...
</div>
```

Стало:
```tsx
<div title={t("timemachine.breachTooltip")} className="cursor-help">
  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
    {t("timemachine.newBreaches")}
  </div>
  ...
</div>
```

3) Новый i18n ключ `timemachine.breachTooltip` в обоих файлах:

```ts
// ru.ts
"timemachine.breachTooltip":
  "Пробой = стресс-прогноз ушёл ниже минимального резерва аккаунта. " +
  "В обычном прогнозе аккаунт под минимум не падает.",

// en.ts
"timemachine.breachTooltip":
  "Breach = stress prognosis dropped below the account's minimum reserve. " +
  "Under the baseline forecast the account never goes below floor.",
```

(Достаточно нативного browser tooltip — никаких новых
`@radix-ui/tooltip` компонентов не подключать. Tooltip-библиотека
ради одной строки — оверкилл.)

---

## Acceptance

1) `/timemachine`, любой сценарий с applied счетами:
   - В каждой карточке видны **две** различимые кривые: серая
     (baseline) и зелёная или красная (stress).
   - Над сеткой карточек — одна inline-легенда (3 точки + лейблы).
2) Footer карточки:
   - Число выровнено лево, ровно под своим лейблом.
   - Число читается заметно ярче и крупнее лейбла.
   - delta остаётся rose-500 при `delta < 0`.
3) Bridges навести мышью на бэйдж «ПРОБОЙ» в карточке → нативный
   browser tooltip с пояснением. Аналогично — на «Новые пробои» в
   result-баре.
4) `npm run lint` exit 0.
5) `npx tsc --noEmit` 0 errors.
6) `npm run build` зелёный.
7) `pytest backend/tests/` — не трогаем, должно остаться 5 passed.

---

## Что НЕ делать

- НЕ трогать `backend/`. Совсем.
- НЕ добавлять `@radix-ui/tooltip` или другую tooltip-либу. `title`
  атрибут — достаточно для демо.
- НЕ менять модель данных. Никаких новых полей в `AccountStressResult`.
- НЕ возвращать аккордеон «Методика», удалённый в 0006.
- НЕ менять `auto-fill` обратно на `auto-fit`.
- НЕ менять цвет delta (rose-500 для negative — устоялось).
- НЕ менять stressColor для `applied === false` (там пунктирная
  серая, она ОК).
- НЕ бампать `next`, `react`, `react-dom`, `eslint`.

---

## PR

PR title: `chore(timemachine): readable card — stress curve color, footer alignment, breach tooltip`

В описании прикрепить:
- before/after скрин одной карточки (EUR-Main подойдёт)
- скрин с раскрытой инлайн-легендой над сеткой
- скрин нативного tooltip'а при наведении на «ПРОБОЙ»

После мержа: я обновлю `.devin/prompts/INDEX.md` с SHA.
