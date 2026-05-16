# LiquidPilot UI polish — round 2 (после коммита e62e69a)

Контекст: предыдущий коммит `e62e69a` починил ~90% жалоб (Floor убран, USD-equiv plane colors, demo-mode инверсия, compact-форматы, hint'ы). Осталось 2 блокера и 4 P1-косяка по контрасту. Работай в `frontend/`.

Запрещено:
- Не трогай `backend/` и `app/services/liquidity/`.
- Не добавляй npm пакеты.
- Все строки — через i18n, новые ключи добавлять одновременно в `src/i18n/messages/en.ts` И `src/i18n/messages/ru.ts` (lockstep, иначе `tsc` упадёт).
- Не модифицируй `displayAccountLabel` / `formatMoneyCompact` — они уже в `src/lib/format.ts`.

---

## БЛОКЕР 1 — `displayAccountLabel` не везде применён

Жалоба юзера была про "EUR-Main, почему Main?". Утилита `displayAccountLabel(accountId)` из `@/lib/format` уже есть и применена в `account-summary-strip.tsx`, `account-card.tsx`, `frozen-capital-card.tsx`. Осталось 4 места где всё ещё светится сырой `EUR-Main` / `USD-Correspondent`.

### 1.1 `src/components/autopilot/action-card.tsx`

а) Заголовок перевода (строки 151-155) — оборачивай оба `account` через `displayAccountLabel`:

```tsx
// было
<div className="font-mono text-sm font-semibold truncate min-w-0">
  <span>{transfer.from_account}</span>
  <span className="text-muted-foreground mx-1.5">→</span>
  <span>{transfer.to_account}</span>
</div>

// стало
<div className="font-mono text-sm font-semibold truncate min-w-0">
  <span>{displayAccountLabel(transfer.from_account)}</span>
  <span className="text-muted-foreground mx-1.5">→</span>
  <span>{displayAccountLabel(transfer.to_account)}</span>
</div>
```

Импорт уже есть только для `formatMoney` — добавь `displayAccountLabel` рядом:

```tsx
import { displayAccountLabel, formatMoney } from "@/lib/format";
```

б) Подтверждающий банер (строки 231-238) — `t("action.move", { from, to, ... })` тоже принимает сырой ID. Передавай label:

```tsx
{t("action.move", {
  amount: amountStr,
  from: displayAccountLabel(transfer.from_account),
  to: displayAccountLabel(transfer.to_account),
  rail: transfer.rail,
  initiateBy: initiateByStr,
})}
```

### 1.2 `src/components/radar/globe-3d.tsx`

а) Массив `TOWERS` (строки 30-42) — поле `label` сейчас хардкодит `"EUR-Main"` и т.д. Замени на пустые строки или удали поле полностью; везде где раньше использовался `tower.label` — используй `displayAccountLabel(tower.id)`.

Ищи использование `tower.label` / `t.label` в файле (есть как минимум в `SpriteLabel` или эквиваленте около строки 433-555). Замени:

```tsx
// было
{tower.label}

// стало
{displayAccountLabel(tower.id)}
```

б) `TooltipData` (interface, строка 139). Поля `src` и `dst` сейчас типа `string` и в них пишутся `tower.id` ("EUR-Main"). Не меняй интерфейс, но в местах **где `TooltipData` рендерится в попапе** (ищи `tooltip.from` / `tooltip.to` или `radar.tooltip.from`) — оборачивай через `displayAccountLabel(data.src)` / `displayAccountLabel(data.dst)`.

В globe-3d при создании `TooltipData` (строки 372-373 — `src: src.id`, `dst: dst.id`) можно сразу писать `src: displayAccountLabel(src.id)`. Тогда не надо менять рендер.

в) Импорт: добавь `import { displayAccountLabel } from "@/lib/format";` если ещё нет.

### 1.3 `src/components/radar/world-map.tsx`

То же самое:
- Массив `TOWERS` (строки 19-32) — поле `label`. Везде `tower.label` → `displayAccountLabel(tower.id)`.
- `TooltipData` (interface, ~109) и место создания (`src: src.id`, `dst: dst.id` ~220-221) — пиши сразу `displayAccountLabel(src.id)`.
- Импорт `displayAccountLabel` если ещё нет.

---

## БЛОКЕР 2 — Confirming-state action-card невидим

`src/components/autopilot/action-card.tsx` строки 222-262: панель подтверждения. Сейчас:

```tsx
<motion.div
  className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2"
>
  <div className="text-xs font-medium text-amber-300">
    {t("action.confirmPrompt")}
  </div>
  <div className="text-[11px] font-mono text-foreground/80 leading-relaxed">
    ...
  </div>
```

`text-amber-300` на `bg-amber-500/10` (светлая жёлто-белая плашка) — текст еле виден. Этот баг тот же что был с ALERT_BANNER, агент его пропустил в подтверждении. Поменяй:

- `bg-amber-500/10` → `bg-amber-50`
- `border-amber-500/40` → `border-amber-500/50`
- `text-amber-300` → `text-amber-800`

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="rounded-md border border-amber-500/50 bg-amber-50 p-3 space-y-2"
>
  <div className="text-xs font-semibold text-amber-800">
    {t("action.confirmPrompt")}
  </div>
```

---

## P1 — контраст на светлой теме (быстрые правки одной заменой)

Это всё shade `*-400` → `*-700` (или `-600` для статусных). На светлом фоне `*-400` блёкнет, юзер прямо это и пишет жалобой "прозрачность всё портит".

### P1.1 `src/components/autopilot/action-card.tsx:195`

```tsx
// было
<div className="text-[10px] font-mono text-amber-400/80 leading-snug border-l-2 border-amber-500/40 pl-2">
  {note}
</div>

// стало
<div className="text-[10px] font-mono text-amber-700 leading-snug border-l-2 border-amber-500/50 pl-2">
  {note}
</div>
```

### P1.2 `src/components/autopilot/action-card.tsx:286-300` (executed state)

```tsx
// было
<div className="flex items-center gap-2 text-emerald-400">
  <Check className="w-4 h-4" />
  <span className="font-mono uppercase tracking-wider">
    {t("action.settledOn", { rail: transfer.rail })}
  </span>
</div>

// стало
<div className="flex items-center gap-2 text-emerald-700">
```

### P1.3 `src/components/autopilot/action-queue.tsx`

Строка 140 (recentlyExecuted toggle):
```tsx
// className="... text-emerald-400/80 hover:text-emerald-400 ..."
// →
// className="... text-emerald-700 hover:text-emerald-800 ..."
```

Строка 201 (infoSection заголовок):
```tsx
// className="... text-amber-400/80"
// →
// className="... text-amber-700"
```

### P1.4 `src/components/radar/account-card.tsx`

Строка 81 (IN label):
```tsx
// className="text-[10px] font-mono tracking-widest uppercase text-emerald-400/80 mb-1"
// →
// className="text-[10px] font-mono tracking-widest uppercase text-emerald-700/80 mb-1"
```

Строка 93 (OUT label):
```tsx
// "text-rose-400/80" → "text-rose-700/80"
```

### P1.5 `src/components/autopilot/autopilot-header.tsx:55-59`

```tsx
// было
{error ? (
  <span className="text-rose-400">{t("status.offline")} · {error}</span>
) : (
  <span className="text-emerald-400">{t("status.online")}</span>
)}

// стало
{error ? (
  <span className="text-rose-600">{t("status.offline")} · {error}</span>
) : (
  <span className="text-emerald-600">{t("status.online")}</span>
)}
```

---

## Acceptance — что проверить перед коммитом

1. `cd frontend && npx tsc --noEmit` — чисто.
2. `cd frontend && npm run build` — Next.js билд проходит. Если упадёт — присылай вывод сюда.
3. Открой `/autopilot` с Demo Mode ON в RU локали (`?lang=ru`):
   - Карточка перевода: "EUR · Frankfurt → USD · New York" (не "EUR-Main → USD-Correspondent").
   - Жми "Исполнить" — confirming-плашка ЖЁЛТАЯ ЯРКАЯ, текст подтверждения чётко читается.
   - Текст ноты под бейджами (если есть) — читается чётко, не блёклый.
4. Открой `/radar`:
   - Hover на самолёт → попап показывает "From: EUR · Frankfurt" (не "EUR-Main").
   - Hover на башню (label-спрайт) → "EUR" / "EUR · Berlin" / "USD · LA", не "EUR-Main" / "EUR-Berlin" / "USD-LA".
   - IN/OUT в карточках счетов — цвет насыщенный, не пастель.
5. Header (любая страница):
   - "online" / "Синхронизация ..." — emerald-600 насыщенный, не светло-зелёный.

## Что НЕ делать

- Не вводи новые i18n ключи если не требуется — в этом раунде их нет.
- Не меняй типы `TooltipData`, `Tower`, `TransferSuggestion` — только то что они **рендерят**.
- Не делай `find/replace text-amber-400 → text-amber-700` глобально — есть места где amber-400 на тёмном фоне (если будут), и важно держать локаль.
- Если запутался какие компоненты используют `tower.label` (особенно в globe-3d) — лучше удали поле `label` из `TOWERS` целиком и пусть TypeScript подскажет где компиляция упала, потом всё переводи через `displayAccountLabel(tower.id)`.

Коммит-сообщение:

```
polish(ui): readable confirming banner, displayAccountLabel everywhere
```
