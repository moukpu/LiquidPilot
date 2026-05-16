# Prompt XXX — Radar / Autopilot / Time Machine UX polish

You are a senior front-end engineer working on **LiquidPilot** (predictive treasury cockpit, hackathon FinTech case). The user (treasurer / hackathon judge) ran the app on real synthetic data and gave concrete feedback. Your job: fix all of the items below in one PR, without touching the FastAPI backend in `backend/app/services/liquidity/` (that's protected). All changes are TypeScript/React in `frontend/`.

Repo: `https://github.com/moukpu/LiquidPilot` (branch off `main`, push as feature branch, open PR).

The hackathon case (one paragraph so you don't lose the plot): mid-size fintech, 9 nostro/correspondent accounts across 7 currencies, deals with SEPA / SWIFT / ACH / CARD / INTERNAL clearing delays, idle vs frozen capital, breach risk forecasting. The judges will demo this in Russian (`ru-RU`) so every fix below must work in **both** `en.ts` and `ru.ts`.

---

## 0. Ground rules

- Stack: Next.js 14 App Router, TS strict, Tailwind, shadcn/ui, framer-motion, react-three-fiber, lucide-react. `"use client"` on every interactive component.
- **Do NOT** add new npm dependencies. Reuse what's already in `frontend/package.json`.
- **Do NOT** modify `backend/app/services/liquidity/` or change backend endpoints. If backend behavior needs to change, gate it on the frontend instead.
- Both `en.ts` and `ru.ts` are `Record<keyof typeof en, string>` so they must stay in lockstep — never add a key to one without the other.
- After your changes, `npm run lint && npm run build` must pass cleanly in `frontend/`.
- Test the live deploy locally with `NEXT_PUBLIC_API_URL=https://liquidpilot.up.railway.app npm run dev` (Railway may be slow; use `http://localhost:8000` if you spin up backend locally).
- Visual sanity: take screenshots of `/radar`, `/autopilot` (both modes), `/timemachine` after a `rail_delay` SWIFT run, attach to PR body.

---

## 1. Time Machine — remove the "Floor" line + clean up

File: `frontend/src/components/timemachine/result-card.tsx`

### 1.1 Kill the floor visualisation entirely

The user explicitly said: **"на странице времени машины, слова Floor на графике убрать"**.

Delete the entire floor block:

```tsx
// DELETE these lines 88-90:
const floorInRange = result.floor >= yMin && result.floor <= yMax;
const floorY = toY(result.floor);
const floorAbove = result.floor > yMax;

// DELETE the <line> floor render (lines ~107-118)
// DELETE the <text> "↑ floor" / "↓ floor" out-of-range render (lines ~119-129)
```

Keep `result.floor` available in `methodology_inputs` (it's already there) so the breach-count badge still works, but no chart artifact.

### 1.2 Re-tune the Y range now that floor is gone

After deletion, the y-range derivation (`baselineVals`, `stressVals`, padding) is already correct. Verify the SVG still renders without empty space.

### 1.3 Page-level polish

File: `frontend/src/app/(dashboard)/timemachine/page.tsx`

- The header (`<h1>{t("timemachine.title")}</h1>` + subtitle) is cramped. Wrap in `glass-card rounded-2xl px-5 py-3 mx-6 mt-4` and bump title to `text-xl` with proper line-height.
- The total-impact strip (`{result && (<div className="flex-1 glass-card ...`) should sit *next to* the scenario picker as today, but make it grid-friendly:
  ```tsx
  <div className="grid grid-cols-1 lg:grid-cols-[18rem,1fr] gap-4 mb-4">
    <ScenarioPicker ... />
    {result ? <TotalImpactStrip ... /> : <ScenarioHint />}  // new placeholder
  </div>
  ```
- Add a `<ScenarioHint />` component (inline in the same file is fine) that shows when `result === null`: an empty-state with 1-line description of each scenario type, so the page is never blank before the user clicks "Run". Add i18n keys `timemachine.hint.pickScenario`, `timemachine.hint.railDelay`, `timemachine.hint.volumeSpike`, `timemachine.hint.bankHoliday` in both EN/RU.

### 1.4 Result-card grid

In `result-card.tsx` the 3-column footer (`baseline_min / stress_min / delta`) wraps awkwardly when many currencies are wide (KZT, JPY). Switch to `grid-cols-3 gap-2 text-[10px]` with `truncate` on the value div and right-align numbers. Render currency on its own row above the number (don't put `KZT 5 061 111 026` on one line).

---

## 2. Autopilot — demo-mode-only data, fix contrast, clean copy

### 2.1 Hard rule: without demo mode → nothing

User said: **"в демо режиме должно быть все на наших данных, а без него НИЧЕГО, даже истории переводов"**.

Today `useAutopilotState` shows real backend `recommendations` when `demoMode = false` and synth data when `demoMode = true`. Invert it:

File: `frontend/src/hooks/use-autopilot-state.ts`

```tsx
// REPLACE:
const alerts = useMemo(
  () => (demoMode ? synthAlerts(accounts) : recommendations.alerts),
  [demoMode, accounts, recommendations.alerts]
);
const transfers = useMemo(
  () => (demoMode ? synthTransfers(accounts) : recommendations.transfers),
  [demoMode, accounts, recommendations.transfers]
);

// WITH:
const alerts = useMemo(
  () => (demoMode ? synthAlerts(accounts) : []),
  [demoMode, accounts]
);
const transfers = useMemo(
  () => (demoMode ? synthTransfers(accounts) : []),
  [demoMode, accounts]
);
```

Drop the `getRecommendations` call from the poll loop entirely (or keep it but ignore the result — prefer dropping to save bandwidth). Update the `AutopilotState` interface and remove the `recommendations` state.

Now when demo mode is off: `accounts` still loads (for the strip), but the action queue, alerts, and session summary stay empty. The `<EmptyState />` already triggers on `queueIsEmpty && showEmptyState`, which is exactly what we want. Verify the empty state copy makes it obvious the user should toggle Demo Mode — the existing `empty.detail` key already does this; just make sure the demo-mode pill in the header is **highlighted / pulses** when no demo mode is on (add a subtle `animate-pulse` ring around the `Switch` when `!demoMode && accounts.length > 0`).

### 2.2 Account summary strip — recolour

File: `frontend/src/components/autopilot/account-summary-strip.tsx`

User asked: **"почему там 2 счета красные?"** — because `statusFor()` reads from real alerts. Since we now feed only synth alerts in demo mode, in normal mode all dots become green — that's the desired behaviour. But two more issues:

1. The pill styling is too low-contrast against the page background (the user's screenshot shows pale gray pills with washed-out emerald dots). Bump contrast:
   ```tsx
   className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-card border border-border shadow-sm"
   ```
   And size the dot `w-2.5 h-2.5` with a subtle drop-shadow.

2. The trailing label `{t("autopilot.summary.linkRadar")}` ("Подробные метрики на Radar" / "Detailed metrics on Radar") — **delete** that whole `<span>`. User explicitly said "лучше убрать прям щас все лишние текста, типа Подробные метрики радара". Also remove the i18n keys `autopilot.summary.linkRadar` from both `en.ts` and `ru.ts` (and any unused `account.percentOfOpening` if you adopt section 3.3).

### 2.3 Action queue contrast

File: `frontend/src/components/autopilot/action-card.tsx`

User said: **"там прозрачность текстов и цветов сильно все портит"**. Issues:

- `ALERT_BANNER_CLASS["CRITICAL"]` is `text-rose-300` on light pink — barely readable on the light theme. The whole light/dark colour scheme was built for dark and got lightened lazily. Replace:

  ```tsx
  const ALERT_BANNER_CLASS: Record<Alert["severity"], string> = {
    CRITICAL: "border-rose-500/50 bg-rose-50 text-rose-700",
    WARNING:  "border-amber-500/50 bg-amber-50 text-amber-800",
    INFO:     "border-primary/40   bg-primary/5 text-foreground",
  };
  ```

  And the same fix for `INFO_BANNER_CLASS` in `action-queue.tsx`. Make the `severity` label (`text-[10px] font-bold uppercase`) inherit the banner's foreground colour, not a different one.

- The card itself: when state is `queued`, `border-border bg-card` reads as washed out. Change to `border-border bg-card shadow-sm` so cards have lift.

- Skipped state opacity 50% means text disappears. Change to `opacity-70` + add a faint diagonal stripe via `background-image: repeating-linear-gradient(...)` so "skipped" is clear without killing readability.

### 2.4 Page chrome

File: `frontend/src/app/(dashboard)/autopilot/page.tsx`

- The wrapper `-m-6 h-[calc(100vh-4rem)]` causes the page to clip the bottom session summary on shorter laptop screens (user's screenshot of the alert card cut off the right edge of "KZT1 601 408 986"). Replace with a flex column that lets the action queue scroll internally and lock the strip + summary to top/bottom:

  ```tsx
  <div className="-mx-6 -mt-6 h-[calc(100vh-4rem)] flex flex-col bg-background">
    <AutopilotHeader ... />
    <AccountSummaryStrip ... />
    <main className="flex-1 min-h-0 overflow-hidden p-6">
      <ActionQueue ... />
    </main>
    <SessionSummary ... />
  </div>
  ```

- Action card: the right-side amount column can be wider than the available width when FX badge is shown next to a 10-digit JPY number. Add `min-w-0` to the left flex item and `max-w-[40%] text-right` to the right amount block so it wraps instead of pushing the row.

### 2.5 Action card → date range badge

The user's screenshot shows `INTERNAL · ДО 2026-05-17 · FX` — the labels are mono and OK, but `ДО 2026-05-17` is shoulder-tight against the bullets. Add small `px-1.5 py-0.5 rounded bg-card border border-border` around each chip so they read as discrete badges instead of a sentence.

---

## 3. Radar — strip extra copy, fix planes, fix account cards

### 3.1 Delete hint texts

User: **"% транзакций, прошедших вовремя за последние 90 дней - убрать текст"** and **"Простаивающий капитал — можно вложить (overnight repo, MMF) без риска breach в течение 7 дней - убрать текст"**.

Remove these renders:
- `frontend/src/components/radar/rail-reliability-card.tsx` — delete the trailing `<div className="mt-3 pt-3 border-t border-slate-200/50 text-[10px] text-muted-foreground">{t("radar.reliability.hint")}</div>` block.
- `frontend/src/components/radar/frozen-capital-card.tsx` — delete the trailing `<div className="mt-3 pt-3 border-t border-slate-200/50 text-[10px] ...">{t("radar.frozen.hint")}</div>` block.

Also delete the i18n keys `radar.reliability.hint` and `radar.frozen.hint` from `en.ts` and `ru.ts`.

### 3.2 Frozen capital card — hide zero rows + compact big numbers

File: `frontend/src/components/radar/frozen-capital-card.tsx`

User: **"JPY-Tokyo JPY 0 SGD-Singapore SGD 0 эти два по нулям? не сгенерировалтись?"** — they ARE zero (balance ≈ safety_buffer for those accounts, so no idle surplus). But showing `KZT 0`, `JPY 0` looks broken. Two fixes:

1. **Skip rows where `amount === 0`**:
   ```tsx
   {Object.entries(perAccount)
     .filter(([, amount]) => amount > 0)
     .map(([id, amount]) => ( ... ))}
   ```

2. **Compact-format huge numbers**:
   ```tsx
   import { formatMoneyCompact } from "@/lib/format"; // add helper
   ...
   <span>{ccy} {formatMoneyCompact(amount, intl)}</span>
   ```
   Add to `frontend/src/lib/format.ts`:
   ```ts
   export function formatMoneyCompact(amount: number, locale: IntlLocale = "en-US"): string {
     return new Intl.NumberFormat(locale, {
       notation: "compact",
       maximumFractionDigits: 2,
     }).format(amount);
   }
   ```
   That renders `KZT 5,06B` / `JPY 1,4B` instead of overflowing.

3. Add an empty-state hint inside the card if every per-account value is zero: `<div className="text-[10px] text-muted-foreground italic">{t("radar.frozen.allDeployed")}</div>` (new i18n key, EN: "All capital deployed — no idle balances right now.", RU: "Свободного капитала нет — всё в работе.").

### 3.3 Account card — re-design copy + responsive numbers

File: `frontend/src/components/radar/account-card.tsx`

User complaints (paraphrased): **"EUR-Main, почему там Main? убрать лучше"**, **"% транзакций / в пути: 24 криво"**, **"448.5% от начального · €51 815 248,14 выше минимума надо переделать"**, **"у кз вообще не видно цифр"**, **"приход и расход — ?"**.

#### 3.3.1 Account display label

Backend `account_id` stays as `EUR-Main` (don't break the API contract). Add a display-only helper at the top of `account-card.tsx`:

```ts
function displayAccountLabel(accountId: string): string {
  // Strip the disambiguator suffix on single-tower accounts.
  // "EUR-Main" → "EUR", "EUR-Berlin" → "EUR · Berlin", "USD-Correspondent" → "USD"
  if (accountId === "EUR-Main") return "EUR";
  if (accountId === "USD-Correspondent") return "USD";
  const [ccy, city] = accountId.split("-");
  if (!city) return ccy;
  return `${ccy} · ${city}`;
}
```

Use it for the headline text in the card (`<div className="font-mono text-sm font-semibold ...">{displayAccountLabel(account.account_id)}</div>`). Keep the secondary line `{account.currency} · {account.country}` as-is.

(Hash/keying everywhere else still uses raw `account_id` — only the display string changes.)

#### 3.3.2 Balance row redesign

The user found `"448.5% от начального · €51 815 248,14 выше минимума"` confusing. Replace the single noisy line with two distinct chips:

```tsx
<div className="relative z-10">
  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1">
    {t("account.ledgerBalance")}
  </div>
  <div className="text-2xl font-mono font-bold tabular-nums text-foreground tracking-tight">
    {sym}{formatMoneyCompact(account.current_ledger_balance, intl)}
  </div>
  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
    <span className={`px-2 py-0.5 rounded-full ${
      aboveFloor >= 0
        ? "bg-emerald-100 text-emerald-700"
        : "bg-rose-100 text-rose-700"
    }`}>
      {aboveFloor >= 0 ? "+" : "−"}{sym}{formatMoneyCompact(Math.abs(aboveFloor), intl)} {t("account.vsFloor")}
    </span>
  </div>
</div>
```

- Replaces the giant 3xl font (which overflowed for KZT billions) with `text-2xl` + compact notation so even `KZT 5,06B` fits.
- Drops the `% от начального` line entirely (low signal, confusing for accumulation > 1 year).
- New i18n key `account.vsFloor` → EN: "vs floor", RU: "к минимуму". Remove `account.aboveFloor`, `account.belowFloor`, `account.percentOfOpening` keys + their usages.

#### 3.3.3 IN / OUT grid

The headings `Приход` / `Расход` (`account.in` / `account.out`) are too terse for users not in finance. Update the i18n values to:
- EN `account.in` → "Inflow today"
- EN `account.out` → "Outflow today"
- RU `account.in` → "Приход за сегодня"
- RU `account.out` → "Расход за сегодня"

And make sure the numbers in those cells also use `formatMoneyCompact` so e.g. `+KZT 1,46B` fits.

#### 3.3.4 "В пути" line

Today: `{t("account.inTransit", { amount: related.length })}` — `related` is the raw count of in-flight transactions for this account, can be 24 / 42 / etc. User found this misleading because the globe only animates 28 planes total.

Fix: compute *both* count and total notional, and label clearly. Replace the bottom row with:

```tsx
{related.length > 0 && (
  <div className="relative z-10 pt-2 border-t border-slate-200/50 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
    <span className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {t("account.inTransit.count", { n: related.length })}
    </span>
    <span className="tabular-nums">
      {sym}{formatMoneyCompact(
        related.reduce((s, tx) => s + Math.abs(tx.amount), 0),
        intl
      )}
    </span>
  </div>
)}
```

Replace key `account.inTransit` with `account.inTransit.count`:
- EN: `"In flight · {n} tx"`
- RU: `"В полёте · {n} тр-ций"`

Don't worry about reconciling with the 28 visible planes — the count now reads as "we know about N transactions in flight for this account, here's the total", which is honest.

### 3.4 Plane colours — fix "all red"

User: **"самолеты все красные, то есть все больше 10 лямов? ебать, почини как было раньше, как то распределно все было"**.

File: `frontend/src/components/radar/globe-3d.tsx`, `planeColorHex()` (lines 94-98). Today: `< 1M green, < 10M yellow, ≥ 10M red`. Problem: KZT amounts in the synthetic data routinely exceed 10M KZT (~22k USD), and even mid-sized EUR transactions cross 1M, so almost every plane lands in the red bucket.

Switch to **USD-equivalent thresholds** (visually consistent across currencies):

```ts
const FX_TO_USD: Record<string, number> = {
  EUR: 1.08, USD: 1.0, GBP: 1.27, CHF: 1.1,
  JPY: 0.0067, SGD: 0.74, KZT: 0.0022,
};

function amountInUsd(tx: Transaction): number {
  // tx.currency is on the type; if missing use account currency via lookup table
  const ccy = (tx as any).currency ?? "USD";
  const fx = FX_TO_USD[ccy] ?? 1.0;
  return Math.abs(tx.amount) * fx;
}

function planeColorHex(tx: Transaction): string {
  const usd = amountInUsd(tx);
  if (usd < 100_000)   return "#22c55e"; // < $100k → green
  if (usd < 1_000_000) return "#eab308"; // < $1M   → yellow
  return "#ef4444";                       // ≥ $1M   → red
}

function planeSize(tx: Transaction): number {
  const usd = amountInUsd(tx);
  if (usd < 100_000)   return 0.004;
  if (usd < 1_000_000) return 0.006;
  return 0.009;
}
```

Update the call sites (`flights = useMemo(... planeColorHex(tx.amount) ...)`) to pass the whole `tx` object. Mirror the same change in `frontend/src/components/radar/world-map.tsx` (`planeColor` and `planeRadius`).

Then update the legend in `frontend/src/app/(dashboard)/radar/page.tsx`:
- EN: `radar.legend.small` → `"< $100k"`, `medium` → `"< $1M"`, `large` → `"≥ $1M"`
- RU: same with `$` prefix.

Verify against the live data: in a fresh poll you should see all three colours, with red being the minority (top-amount SWIFT/INTERNAL transfers), yellow being daily card clearings, green being micro-payments.

### 3.5 Sidebar tooltip / Account-id chip in summary strip

In `account-summary-strip.tsx`, the strip uses raw `a.account_id`. Use the new `displayAccountLabel()` helper here too so the chips read `EUR`, `EUR · Berlin`, etc., consistent with the right-rail cards. Move `displayAccountLabel` to `frontend/src/lib/format.ts` so it's reusable.

---

## 4. Wire-up checklist (do not skip)

Order matters; this minimises lint/build churn:

1. **i18n first**: edit `frontend/src/i18n/messages/en.ts` and `frontend/src/i18n/messages/ru.ts` together:
   - Delete: `radar.frozen.hint`, `radar.reliability.hint`, `autopilot.summary.linkRadar`, `account.aboveFloor`, `account.belowFloor`, `account.percentOfOpening`, `account.inTransit`.
   - Add: `account.vsFloor`, `account.inTransit.count`, `radar.frozen.allDeployed`, `timemachine.hint.pickScenario`, `timemachine.hint.railDelay`, `timemachine.hint.volumeSpike`, `timemachine.hint.bankHoliday`.
   - Update wording: `account.in`, `account.out` (see §3.3.3).
   - Update legend labels: `radar.legend.small/medium/large`.
2. **format.ts**: add `formatMoneyCompact()` and `displayAccountLabel()`.
3. **Time Machine**: section 1.
4. **Autopilot hook + components**: section 2.
5. **Radar cards and globe**: section 3.
6. **Final pass**:
   - `npm run lint`
   - `npm run build`
   - `npm run dev`, click through `/radar` (account cards render, planes have 3 colours, no hint text), `/autopilot` with Demo OFF (empty state) and Demo ON (alerts + transfers, readable banners), `/timemachine` (run a SWIFT rail_delay, no Floor line in the chart, header looks clean before/after run).
   - Screenshot all three pages in RU locale, attach to PR.

---

## 5. Acceptance checklist (paste into PR description)

- [ ] Time Machine: zero references to `floor` rendering in `result-card.tsx`; chart shows only baseline (grey) + stress (green/red) curves.
- [ ] Time Machine: page header + scenario picker + total-impact strip read as a coherent layout in both EN and RU.
- [ ] Autopilot: Demo Mode OFF ⇒ `<EmptyState />` is the only thing in the queue, session summary shows zeros, no real alerts surface.
- [ ] Autopilot: Demo Mode ON ⇒ 2 synth alerts + 2 synth transfers render; banners are readable on a light background (rose-700 / amber-800 text).
- [ ] Autopilot: "Подробные метрики на Radar" / "Detailed metrics on Radar" string is gone everywhere.
- [ ] Radar: no "% transactions on time…" / "Idle capital…" hint paragraphs anywhere.
- [ ] Radar: account cards show `EUR`, `EUR · Berlin`, `USD`, `USD · LA`, `CHF · Zurich`, etc. — never `EUR-Main` or `USD-Correspondent` in user-facing text.
- [ ] Radar: KZT-Almaty card renders the full balance (compact notation, no overflow); rose / emerald chip shows `+KZT 4,56B к минимуму`.
- [ ] Radar: globe shows green, yellow, red planes in roughly proportional numbers (eye-ball: red ≤ ~30% of visible planes, not 100%).
- [ ] Radar: Frozen Liquidity card hides JPY-Tokyo / SGD-Singapore rows when their idle amount is 0; if all rows would be zero, shows the "All capital deployed" empty state.
- [ ] `npm run lint && npm run build` clean.
- [ ] Three screenshots (RU locale) attached: `/radar`, `/autopilot` (demo ON), `/timemachine` (after run).

---

## 6. Out of scope (don't do these in this PR)

- Touching `backend/app/services/liquidity/*` — protected.
- Adding the Contagion graph — that's a separate prompt (`prompt_contagion.md`).
- Changing the global colour theme / Tailwind config — only fix the specific banners/chips listed.
- Pulling FX rates from the backend — hard-code the static `FX_TO_USD` table that's already used in `session-summary.tsx`.
- Removing the `getRecommendations` API client entirely (it's still used by other components in the future Contagion phase).
