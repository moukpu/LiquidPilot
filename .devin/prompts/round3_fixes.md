# LiquidPilot — Round 3 polish & feature fixes

**Repo:** https://github.com/moukpu/liquidpilot · **Base:** `28612ee` (origin/main)
**Push:** напрямую в `main` (без feature-branch и PR). Один коммит на всю задачу.
**Запреты:**
- НЕ трогать backend (`backend/app/services/liquidity/*`).
- НЕ добавлять новые npm-пакеты. Только то что уже есть.
- НЕ менять контракт API (`/accounts`, `/radar`, `/stress`).
- НЕ создавать новые i18n-ключи без обновления **обоих** каталогов `en.ts` + `ru.ts`.
- Запретные команды: `--no-verify`, `git reset --hard`, `git push --force`.

**Тех. требования к финалу:**
- `npx tsc --noEmit` — clean.
- `npm run build` в `frontend/` — успех. Если упадёт — фиксить прежде чем пушить.
- Коммит-сообщение: `polish(ui): real flight counts, FX preview, scrolling, i18n lockstep`.

---

## Контекст
Пользователь протестировал коммит `28612ee` и нашёл **17 проблем**. Часть — регрессии прошлого раунда (over-truncation в Time Machine, убито листание страниц). Часть — pre-existing UX/data accuracy. Одна — новая фича (плашка-самолёт на radar при Execute).

Все правки сгруппированы по приоритетам ниже. **Делай ровно в порядке P0 → P1 → P2.** Не отвлекайся на рефакторинг чего-либо вне этого списка.

---

## P0 — Регрессии прошлого раунда (СРОЧНО, чинить в первую очередь)

### P0.1 — Вернуть листание страниц
**Симптом:** на лендинге кнопки/фичи ниже первого экрана не видно — нельзя скроллить. На `/autopilot` секции «Открытые алерты», «Пропущено» обрезаются. На длинных листах в radar/timemachine та же история.

**Корень:** `body className="… overflow-hidden h-screen w-screen"` в <ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/layout.tsx" lines="32-34" /> + `pt-16 h-full` обёртка в <ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/layout.tsx" lines="56-58" /> + жёсткий `h-[calc(100vh-4rem)] overflow-hidden` на autopilot-page <ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/(dashboard)/autopilot/page.tsx" lines="40-52" />.

**Фикс:**

1. `frontend/src/app/layout.tsx` строка 33: `overflow-hidden h-screen w-screen` → `min-h-screen overflow-x-hidden`.
2. `frontend/src/app/layout.tsx` строка 56: `<div className="pt-16 h-full relative">` → `<div className="pt-16 relative">`.
3. `frontend/src/app/(dashboard)/layout.tsx`: оставить `w-full relative` (убрать `h-full`).
4. `frontend/src/app/(dashboard)/autopilot/page.tsx` строка 40: убрать `h-[calc(100vh-4rem)] flex flex-col` — заменить на `min-h-[calc(100vh-4rem)] flex flex-col`. На строке 52 убрать `overflow-hidden` с `<main>` (оставить `flex-1 min-h-0 p-6`). Внутренний `<ActionQueue>` уже имеет свой `overflow-auto` на flex-1 контейнере (<ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/autopilot/action-queue.tsx" lines="106" />) — этого достаточно, секции «Открытые алерты» / «Пропущено» теперь полностью видны и скроллятся внутри списка.
5. **Radar ИСКЛЮЧЕНИЕ:** `frontend/src/app/(dashboard)/radar/page.tsx` строка 88 — оставить `w-full h-full relative overflow-hidden` КАК ЕСТЬ. На radar нужен fixed viewport под 3D-globe, иначе глобус будет тянуться вниз. Чтобы это работало после фикса (1)-(3), на radar-page оберни корень в `<div style={{ height: "calc(100vh - 4rem)" }}>` либо tailwind `h-[calc(100vh-4rem)]`. Скроллится только правая колонка карточек (там уже `overflow-y-auto` на строке 141).

**Acceptance:**
- На главной (`/`) видно hero + 4 карточки фичей (Radar/Autopilot/Contagion/Time Machine) — листанием.
- На `/autopilot` с Demo ON: видно все секции (Активные алёрты → Очередь → Recently executed → Skipped → Open alerts) — можно прокрутить внутри списка очереди.
- На `/timemachine` после run: видно все карточки счетов вниз (9 счетов).
- На `/radar`: glob занимает весь экран, правая колонка карточек скроллится отдельно, никаких внешних scrollbar.

---

### P0.2 — Time Machine: вернуть нормальную длину текста, compact только для миллионов+
**Симптом:** все три футер-цифры (Baseline min / Stress min / Delta) и весь блок «Methodology» обрезаны (`truncate`), валюта вынесена на отдельную строку, всё нечитаемо. Юзер: «там буквально все текста скоращены и не понятно, пусть вернет как было, но если есть миллины и т д пусть пишет кратко».

**Фикс:**

Файл: <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/timemachine/result-card.tsx" />

1. **Функция `FooterStat` (строки 150-187):** удалить вложенную строку с валютой (`<div className="text-[9px] text-muted-foreground/70 mt-0.5">{currency}</div>`). Убрать `truncate` с обоих div'ов. Формат вывода — на одной строке: `КЦБ EUR 12,5М` (или полная сумма, если <1M).
2. **Логика выбора формата:** добавить вспомогательную функцию в файл (либо использовать `formatMoneyCompact` условно):
   ```tsx
   function formatStatAmount(amount: number, intl: IntlLocale): string {
     // Compact только для абсолютных значений ≥ 1,000,000.
     // Меньше — полное число с разделителями, чтобы тысячи читались.
     if (Math.abs(amount) >= 1_000_000) {
       return formatMoneyCompact(amount, intl); // "1.2M" / "1,2 млн"
     }
     return formatNumber(amount, 0, intl); // "543,210"
   }
   ```
   В `FooterStat` использовать `formatStatAmount(amount, intl)` вместо `formatMoneyCompact(amount, intl)`.
3. **Layout:** валюта и число на одной строке: 
   ```tsx
   <div className="min-w-0">
     <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
       {label}
     </div>
     <div
       className={`tabular-nums text-right whitespace-nowrap text-[10px] ${tone}`}
       title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
     >
       {sign}{currency} {formatStatAmount(amount, intl)}
     </div>
   </div>
   ```
4. **Methodology rows (функция `Row` строки 284-305):** убрать `truncate` с лейбла — пусть переносится. Цифры справа оставить `tabular-nums` без truncate.

**Acceptance:**
- На `/timemachine` после прогона `rail_delay SWIFT +3d`: на каждой карточке видно полностью «BASELINE MIN EUR 543,210» / «STRESS MIN EUR 489,100» / «DELTA −EUR 54,110» — НЕ обрезано, валюта в той же строке, что и число.
- На карточке KZT-Almaty (миллиарды KZT): видно «BASELINE MIN KZT 2,5Б» (compact) — без обрезания.
- В методологии (раскрытом аккордеоне): все строки читаются без обрезания.

---

### P0.3 — i18n lockstep: убрать смешанный язык в «Не применено»
**Симптом:** карточка stress-result в RU локали показывает «Не применено: no inbound transactions on this rail for this account» (русское «Не применено» + английский reason от бэка).

**Корень:** <ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/timemachine/result-card.tsx" lines="201-207" /> — `String(inputs.reason ?? "n/a")` использует сырой английский string из бэка <ref_snippet file="/home/ubuntu/repos/LiquidPilot/backend/app/services/liquidity/stress.py" lines="184" />.

**Фикс:** перевести reason на фронте через словарь известных backend-причин. НЕ трогая backend.

1. Добавить i18n-ключи в **обоих** `en.ts` + `ru.ts`:
   ```ts
   // en.ts
   "timemachine.reason.noInboundOnRail": "no inbound transactions on this rail for this account",
   "timemachine.reason.noOutboundOnRail": "no outbound transactions on this rail for this account",
   "timemachine.reason.countryMismatch": "account country does not match holiday country",
   "timemachine.reason.zeroMultiplier": "multiplier ≤ 1 — no spike",
   "timemachine.reason.unknown": "scenario not applicable",

   // ru.ts
   "timemachine.reason.noInboundOnRail": "по этому рельсу для счёта нет входящих транзакций",
   "timemachine.reason.noOutboundOnRail": "по этому рельсу для счёта нет исходящих транзакций",
   "timemachine.reason.countryMismatch": "страна счёта не совпадает со страной выходного",
   "timemachine.reason.zeroMultiplier": "множитель ≤ 1 — всплеска нет",
   "timemachine.reason.unknown": "сценарий неприменим",
   ```

2. В `result-card.tsx` строки 201-207 — маппинг строки от бэка на ключ:
   ```tsx
   function translateReason(raw: unknown, t: (k: MessageKey) => string): string {
     const s = String(raw ?? "");
     if (s.includes("no inbound")) return t("timemachine.reason.noInboundOnRail");
     if (s.includes("no outbound")) return t("timemachine.reason.noOutboundOnRail");
     if (s.includes("country") && s.includes("not")) return t("timemachine.reason.countryMismatch");
     if (s.includes("multiplier")) return t("timemachine.reason.zeroMultiplier");
     return t("timemachine.reason.unknown");
   }
   ```
   Импортировать `MessageKey` из `@/i18n/messages/en`. В блоке `if (inputs.applied === false)`:
   ```tsx
   <p className="text-[10px] text-muted-foreground italic">
     {t("timemachine.method.notApplied")}: {translateReason(inputs.reason, t)}
   </p>
   ```

**Acceptance:**
- Локаль RU + `rail_delay SEPA` на счёте, где SEPA не используется → видно «Не применено: по этому рельсу для счёта нет входящих транзакций» (весь текст русский).
- Локаль EN + такой же сценарий → «Not applied: no inbound transactions on this rail for this account».
- Никаких смешанных языков. **Прочеши** через `grep -r` все остальные `String(.*reason` / `String(.*error` в проекте — нет ли где ещё сырой backend-строки в UI.

---

## P1 — Точность данных и читаемость карточек radar

### P1.1 — Account-card: убрать «Бухгалтерский баланс», выровнять в одну строку
**Симптом:** на карточке счёта в `/radar` сверху подпись «Бухгалтерский баланс» — мусор, удалить. Балансы и chip ±vs floor стоят на разных строках криво.

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/radar/account-card.tsx" />

1. Удалить блок строки 52-55 целиком:
   ```tsx
   <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1">
     {t("account.ledgerBalance")}
   </div>
   ```
2. Удалить i18n-ключ `account.ledgerBalance` из **обоих** `en.ts` (строка 55) и `ru.ts` (строка 56). Также убедиться что больше нигде не используется — `grep -r "account.ledgerBalance" frontend/src`.
3. Объединить блок баланса (строки 60-63) и chip vs floor (строки 64-76) в одну flex-строку, чтобы кружок/chip стоял справа от суммы:
   ```tsx
   <div className="relative z-10">
     <div className="flex items-baseline justify-between gap-3">
       <div className="text-2xl font-mono font-bold tabular-nums text-foreground tracking-tight">
         {sym}{formatMoneyCompact(account.current_ledger_balance, intl)}
       </div>
       <span
         className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono ${
           aboveFloor >= 0
             ? "bg-emerald-100 text-emerald-700"
             : "bg-rose-100 text-rose-700"
         }`}
       >
         {aboveFloor >= 0 ? "+" : "−"}{sym}{formatMoneyCompact(Math.abs(aboveFloor), intl)} {t("account.vsFloor")}
       </span>
     </div>
   </div>
   ```

**Acceptance:** карточка EUR-Frankfurt в `/radar` показывает: заголовок `EUR · FRANKFURT` → сразу под ним строка `€1,2M  [+€450к к минимуму]` (сумма и зелёный chip в одной строке). Подписи «Бухгалтерский баланс» нет нигде в app.

---

### P1.2 — Account-card: реальное число «в полёте» + сумма
**Симптом:** «В ПОЛЁТЕ · 48 ТР-ЦИЙ» — юзер думает, что это рандом. На самом деле это `related.length` — все транзакции для счёта в текущем окне `/radar/`. Проблема — название врёт: эти tx-ки уже settled, в воздухе их нет, и в radar-globe анимируются только pending. Нужно показать ровно то что юзер видит на globe.

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/radar/account-card.tsx" />

1. На радаре «в полёте» = transactions с `value_date >= today` (ещё не settled). Backend в `Transaction` отдаёт `value_date`. Считать так:
   ```tsx
   // в начале AccountCard
   const today = new Date().toISOString().slice(0, 10);
   const inFlight = related.filter((tx) => tx.value_date >= today);
   const inFlightCount = inFlight.length;
   const inFlightSum = inFlight.reduce((s, tx) => s + Math.abs(tx.amount), 0);
   ```
   Использовать `inFlightCount` / `inFlightSum` вместо текущих `related.length` / `inFlightSum`. Старая переменная `inFlightSum` пересчитывается на новый фильтр (строка 26).
2. Блок строк 106-117 показывает count + sum. Если `inFlightCount === 0` — секцию не рендерим (как сейчас).
3. **ВАЖНО:** число в `account-card.inTransit.count` ДОЛЖНО совпадать с тем что отрисовано на 3D-globe для этого аккаунта. Открой `frontend/src/components/radar/globe-3d.tsx` и проверь по какому полю фильтруются плашки-самолёты. Если на globe используется тот же `transactions[]` без фильтра по дате — добавь такой же фильтр `value_date >= today` в `globe-3d.tsx`. Тогда счётчик == # реальных летящих самолётов.

**Acceptance:**
- На `/radar`: открой DevTools, посчитай руками число анимирующихся самолётов привязанных к EUR-Frankfurt. Это число равно тому что показано на карточке EUR-Frankfurt в строке «В ПОЛЁТЕ · N ТР-ЦИЙ».
- Сумма справа = сумма абсолютных значений именно этих N транзакций.
- Если для счёта нет транзакций в полёте (например, в воскресенье или после прогона всех settle) — строка скрыта.

---

### P1.3 — Удалить колонку `T+0...T+2.3` из Rail Reliability
**Симптом:** юзер: «не понимаю смысл этих букв типа т+0, т+0...1 и т п. либо убрать либо убрать». Это `r.expected_delay_range` от бэка.

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/radar/rail-reliability-card.tsx" />

Удалить span строки 53-55:
```tsx
<span className="text-muted-foreground/60 text-[10px] w-14 text-right">
  {r.expected_delay_range}
</span>
```
Колонки теперь три: rail name | reliability % | dots. Поле `expected_delay_range` остаётся в типе API — не трогать.

**Acceptance:** на `/radar` в левой нижней панели «Надёжность рельсов» — только `INTERNAL · 99.5% · ●●●●●` (три колонки), никаких `T+0`.

---

### P1.4 — Скрыть «SYSTEM ONLINE» в верхнем правом углу, оставить аватар «LP»
**Симптом:** юзер: «профиль LP — оставить если надо, а SYSTEM ONLINE нахуй».

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/layout.tsx" />

Удалить строки 50-51 (зелёный кружок + текст):
```tsx
<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
<span className="text-xs font-mono text-muted-foreground hidden sm:inline-block tracking-widest">SYSTEM ONLINE</span>
```
Также убрать `border-l border-white/10 pl-6` с обёртки (строка 49) — без зелёного кружка и текста разделитель не нужен. Оставить только `<div className="flex items-center"> <div className="w-8 h-8 rounded-full bg-primary/20 …">LP</div> </div>`.

**Acceptance:** в шапке справа: language switcher + аватар `LP`. Никаких зелёных кружков и «SYSTEM ONLINE».

---

## P2 — Autopilot: FX-конвертация, отступы, ясность секций

### P2.1 — Убрать «FX» badge с карточки действия
**Симптом:** юзер: «прозрачные FX-плашки убрать».

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/autopilot/action-card.tsx" />

Удалить блок строки 183-187:
```tsx
{transfer.requires_fx && (
  <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-500/40 text-amber-700">
    {t("action.fxBadge")}
  </span>
)}
```
Также удалить i18n-ключ `action.fxBadge` из `en.ts` строка 120 и `ru.ts` строка 120 (если нигде больше не используется — проверь `grep`).

**Note:** правая колонка сверху (строки 161-169) уже показывает `EUR → USD` маленькими буквами под суммой — это останется, информация о FX-конверсии не теряется. Просто убирается дублирующий badge.

---

### P2.2 — Заменить backend-note «считайте в источнике…» на реальную FX-конвертацию
**Симптом:** юзер: «вместо считайте в валюте источника напиши сразу конвертацию, типо KZT 350000 → EUR 840». Текущая нота — теоретическая болтовня из `backend.transfer.note.fx`.

**Фикс:**

1. **Удалить** функцию-вызов `translateBackendNote(transfer, locale)` из <ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/autopilot/action-card.tsx" lines="83" /> и блок рендера строк 194-198. Сам экспорт `translateBackendNote` в `translate-backend.ts` оставить (вдруг где ещё юзается — проверь grep'ом, скорее всего нет → можно тоже удалить вместе с двумя ключами `backend.transfer.note.fx` / `backend.transfer.note.escalate`).
2. **Добавить** новый блок в action-card на том же месте, который рендерит реальный preview конвертации:
   ```tsx
   {transfer.requires_fx && (
     <div className="text-[10px] font-mono leading-snug border-l-2 border-amber-500/50 pl-2 text-amber-700">
       {formatMoney(transfer.amount, transfer.currency_from, { fractionDigits: 0 }, intl)}
       {" → "}
       {formatMoney(
         convertFx(transfer.amount, transfer.currency_from, transfer.currency_to),
         transfer.currency_to,
         { fractionDigits: 0 },
         intl
       )}
       <span className="ml-2 opacity-60">
         @ {fxRate(transfer.currency_from, transfer.currency_to).toFixed(4)} {transfer.currency_from}/{transfer.currency_to}
       </span>
     </div>
   )}
   ```
3. **Создать** helper `frontend/src/lib/fx.ts`:
   ```ts
   // FX rates в USD-эквиваленте — должны совпадать с globe-3d.tsx FX_TO_USD.
   // ВАЖНО: если в globe-3d.tsx / world-map.tsx уже есть FX_TO_USD —
   // ВЫНЕСИ его сюда и импортируй из обоих мест. Один источник истины.
   export const FX_TO_USD: Record<string, number> = {
     EUR: 1.08,
     USD: 1.0,
     GBP: 1.27,
     CHF: 1.1,
     JPY: 0.0067,
     SGD: 0.74,
     KZT: 0.0022,
   };

   export function fxRate(from: string, to: string): number {
     const fromUsd = FX_TO_USD[from] ?? 1;
     const toUsd = FX_TO_USD[to] ?? 1;
     return fromUsd / toUsd;
   }

   export function convertFx(amount: number, from: string, to: string): number {
     return amount * fxRate(from, to);
   }
   ```
   Импортировать `fxRate`, `convertFx` в action-card.

**Acceptance:**
- Любая FX-карточка в autopilot (например KZT-Almaty → EUR-Frankfurt): вместо абзаца «Требуется конвертация…» видно `KZT 350,000 → EUR 770 @ 0.0022 KZT/EUR` (числа примерные, главное — реальная конверсия).
- FX rates в action-card совпадают с FX_TO_USD в globe-3d/world-map (один источник истины).

---

### P2.3 — Убрать прозрачность/прижатие текстов к краям на autopilot
**Симптом:** юзер на 4-м скрине: «там до сих пор текста не видно т к они слишком впритык к краям». На скрине видно что заголовки секций («Активные алёрты», «Недавно исполнено · 2», «Открытые алерты · 8») чуть приплюснуты + контраст плох + в самих карточках текст вплотную к левому краю.

**Фикс:**

1. `action-queue.tsx` строка 106 — увеличить горизонтальный паддинг внутреннего скролл-контейнера: `p-4 space-y-3` → `px-5 py-4 space-y-3`.
2. `action-queue.tsx` строки 140 и 201 — секции «Recently executed» и «Open alerts»: добавить вертикальный отступ сверху, чтобы не прилипали к предыдущему блоку: `py-1` → `py-2`. Также бамп контраста на лейбле «Open alerts»: `text-amber-700` уже OK, но размер: `text-[10px]` → `text-[11px] font-semibold`.
3. `action-card.tsx` строка 118 — `rounded-lg border p-4 space-y-3` → `rounded-lg border px-5 py-4 space-y-3` (внутри карточки больше воздуха слева/справа).
4. `action-card.tsx` правая колонка строки 157-170: убрать `max-w-[40%]` — на узких карточках это ужимает сумму до неразборчивого вида. Заменить на `min-w-0 shrink-0` (правая колонка будет автоширины, левая колонка `flex-1 min-w-0` уже truncate-ит).

**Acceptance:**
- В autopilot Demo ON: открыта секция «Recently executed · 2» — текст «RECENTLY EXECUTED · 2» виден полностью, не прилеплен к левому краю, контраст читаемый.
- Карточка transfer'а: сумма справа (`+EUR 350,000`) полностью видна на узких viewport (≥ 1280px).
- Между секциями есть видимый вертикальный gap.

---

### P2.4 — Объяснить «Открытые алерты» в шапке секции (или оставить как есть, не удалять)
**Симптом:** юзер: «зачем на фото открытые алерты, типо че они дают, как мне могут помочь, нужны ли они вообще». Это секция info-only alerts — алёрты по счетам, для которых движок НЕ предложил перевод (нет донора без пробития своего буфера). Это важная инфа: «есть проблема, но автопилот не может её сам решить — нужен treasurer». **НЕ УДАЛЯТЬ** секцию. Добавить пояснительную подпись.

**Фикс:** <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/components/autopilot/action-queue.tsx" />

Под лейблом секции (строка 201-205) добавить подпись:
```tsx
<div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-semibold">
  {t("autopilot.queue.infoSection", { n: infoOnlyAlerts.length })}
</div>
<div className="text-[10px] text-muted-foreground leading-relaxed -mt-1">
  {t("autopilot.queue.infoSectionHint")}
</div>
```

Новые i18n-ключи:
```ts
// en.ts
"autopilot.queue.infoSectionHint": "Forecasted breaches the engine cannot auto-resolve — no donor account has surplus. Manual treasurer action: arrange credit line / FX swap / repo.",

// ru.ts
"autopilot.queue.infoSectionHint": "Прогнозируемые пробои, которые движок не может закрыть автоматически — нет счёта-донора с излишком. Решает казначей вручную: кредитная линия / FX-своп / репо.",
```

**Acceptance:** под заголовком «Открытые алерты · 8» появилась серая поясняющая строка о том, почему движок не предложил перевод.

---

## P3 — Новая фича: Execute → анимация самолёта на radar

**Симптом:** юзер: «когда мы в автопилоте нажимаем Исполнить, надо запустить реальную транзакцию-самолётик на radar, другого цвета и со скоростью соответствующей сумме».

**Реализация (минимальная, без backend):**

### P3.1 — Глобальный store для «execute events»
Создать `frontend/src/lib/execute-events.ts`:
```ts
"use client";

import { useEffect, useState } from "react";

export interface ExecuteEvent {
  id: string;
  from_account: string;
  to_account: string;
  amount: number;
  currency_from: string;
  currency_to: string;
  rail: string;
  requires_fx: boolean;
  /** ms since epoch — used to expire stale events */
  startedAt: number;
}

const STORAGE_KEY = "autopilot-execute-events";
const TTL_MS = 30_000; // самолёт живёт 30 секунд

type Listener = (events: ExecuteEvent[]) => void;
const listeners = new Set<Listener>();

function read(): ExecuteEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ExecuteEvent[];
    const now = Date.now();
    return arr.filter((e) => now - e.startedAt < TTL_MS);
  } catch {
    return [];
  }
}

function write(events: ExecuteEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(events);
}

export function pushExecuteEvent(e: Omit<ExecuteEvent, "id" | "startedAt">) {
  const event: ExecuteEvent = {
    ...e,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
  };
  write([...read(), event]);
}

export function useExecuteEvents(): ExecuteEvent[] {
  const [events, setEvents] = useState<ExecuteEvent[]>(read);
  useEffect(() => {
    listeners.add(setEvents);
    const tick = setInterval(() => setEvents(read()), 1000);
    return () => {
      listeners.delete(setEvents);
      clearInterval(tick);
    };
  }, []);
  return events;
}
```

### P3.2 — Эмитить event при подтверждении executing
В `action-card.tsx` найди useEffect для `state === "executing"` (строки 102-109) — там сейчас просто таймер на 1.6 сек, потом `onChange("executed")`. Добавь ВЫЗОВ `pushExecuteEvent` при переходе в executing:
```tsx
useEffect(() => {
  if (state === "executing") {
    pushExecuteEvent({
      from_account: transfer.from_account,
      to_account: transfer.to_account,
      amount: transfer.amount,
      currency_from: transfer.currency_from,
      currency_to: transfer.currency_to,
      rail: transfer.rail,
      requires_fx: transfer.requires_fx,
    });
    const timer = setTimeout(() => onChange("executed"), EXECUTING_DURATION_MS);
    return () => clearTimeout(timer);
  }
}, [state, onChange, transfer]);
```
Импортировать `pushExecuteEvent` из `@/lib/execute-events`.

### P3.3 — На radar рендерить execute-плашки поверх обычных
В `globe-3d.tsx` (и `world-map.tsx` если используется fallback):
- Добавить `import { useExecuteEvents } from "@/lib/execute-events";` 
- Внутри компонента: `const executeEvents = useExecuteEvents();`
- Для каждого `ev` в `executeEvents`:
   - Координаты: from = координаты `ev.from_account` tower, to = координаты `ev.to_account` tower.
   - Прогресс анимации: `t = Math.min(1, (Date.now() - ev.startedAt) / FLIGHT_DURATION)`, где `FLIGHT_DURATION` пропорционален сумме (например `Math.min(15000, Math.max(3000, ev.amount / 1000))`) — крупная сумма летит **медленнее** (она «весит» больше; в кейсе важно подчеркнуть масштаб).
   - Цвет: **отличный от обычных самолётов** — используй `#a855f7` (violet-500) — фиолетовый, чтобы execute-самолёт сразу выделялся на фоне зелёных/жёлтых/красных синтетических.
   - Размер plane sprite на ~30% больше обычных.
   - Если `t >= 1` — самолёт «приземлился» и далее скрывается (TTL store сам удалит запись через 30с).

**ВАЖНО:** конкретная реализация анимации зависит от того что уже есть в `globe-3d.tsx` / `world-map.tsx`. Открой эти файлы, разберись как анимируется обычная плашка (вероятно по `frame` / `useFrame`), и сделай по той же модели — просто добавь второй loop по `executeEvents` с другим цветом/размером/скоростью.

### P3.4 — Уведомление на radar когда летит execute-плашка
В верхнем-левом status bar radar-page (<ref_snippet file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/(dashboard)/radar/page.tsx" lines="94-108" />) добавь маленький индикатор:
```tsx
const executeEvents = useExecuteEvents();
{executeEvents.length > 0 && (
  <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-violet-500 border-l border-slate-200/50 pl-4">
    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
    {t("radar.executeInFlight", { n: executeEvents.length })}
  </span>
)}
```

Новые i18n:
```ts
// en.ts
"radar.executeInFlight": "Autopilot · {n} in flight",
// ru.ts
"radar.executeInFlight": "Автопилот · {n} в полёте",
```

**Acceptance:**
- Включить Demo Mode на `/autopilot`, нажать Execute → Confirm Execution на любой карточке. В соседней вкладке (или после перехода) `/radar` — видно фиолетовый самолётик, летящий от tower'а отправителя к tower'у получателя.
- Сумма transfer'а влияет на скорость: 350,000 EUR летит ~5 секунд, 5,000,000 EUR летит ~15 секунд.
- В статус-баре radar появляется индикатор «Автопилот · 1 в полёте».
- Самолёт исчезает по приземлении (или через 30 сек как fail-safe).
- Перезагрузка radar в течение TTL — самолёт всё ещё летит (state в sessionStorage).

---

## P4 — Косметика и текст (приоритет ниже, но включить)

### P4.1 — Time Machine: убрать заголовок-простыню «Time Machine — стресс-тест / Pick a scenario…»
На странице `/timemachine` верх занимает огромный заголовок + subtitle. Юзер просил вычистить лишнее. Оставить только маленький eyebrow `Time Machine` + один summary status. Открой `frontend/src/app/(dashboard)/timemachine/page.tsx`, найди рендер `t("timemachine.title")` + `t("timemachine.subtitle")` — заменить на компактный layout (что-то типа `Autopilot · Command Center` eyebrow + одну строку с metric counts).

### P4.2 — Лендинг: убрать `min-h-[calc(100vh-4rem)]` на main
В `frontend/src/app/page.tsx` строка 52: `min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center` → `flex flex-col items-center py-12`. Иначе после фикса P0.1 hero всё ещё центрируется по всему экрану, и карточки фичей не скроллятся в normal flow.

### P4.3 — Подпись «Outflow volume spike» — обновить i18n чтобы было понятнее
- `en.ts` строка 138: `"timemachine.scenarios.volumeSpike": "Outflow volume spike"` → `"timemachine.scenarios.volumeSpike": "Outflow spike (chargebacks / payouts)"`.
- `ru.ts` строка 139: `"Всплеск исходящих платежей"` → `"Всплеск расхода (чарджбеки / выплаты)"`.

### P4.4 — Если в Time Machine «New breaches» = 0 после прогона — показать пояснение
В <ref_file file="/home/ubuntu/repos/LiquidPilot/frontend/src/app/(dashboard)/timemachine/page.tsx" /> в summary блоке после прогона, если `result.summary.new_breach_count === 0` — добавить серую строку «Стресс прошёл — ни один счёт не свалился под минимум при этом сценарии. Попробуй жёстче (rail_delay +5d / multiplier ≥1.6 / bank_holiday 4d).». Это снимет вопрос «работают ли вообще новые пробои».

Новые i18n-ключи:
```ts
// en.ts
"timemachine.summary.noBreaches": "Stress passed — no account drops below floor under this scenario. Try harder (rail_delay +5d / multiplier ≥1.6 / bank_holiday 4d).",
// ru.ts
"timemachine.summary.noBreaches": "Стресс прошёл — ни один счёт не свалился под минимум. Попробуй жёстче (rail_delay +5d / multiplier ≥1.6 / bank_holiday 4d).",
```

---

## Финальный acceptance-чеклист (пробежаться перед коммитом)

Запусти dev-сервер (`npm run dev` в `frontend/`), открой в браузере, переключи RU локаль. Пройти каждую страницу:

### `/`
- [ ] Hero и 4 карточки фичей видно. Можно листать (был fold-bug — нет больше).
- [ ] В шапке справа: language switcher + аватар `LP`. БЕЗ «SYSTEM ONLINE».

### `/radar`
- [ ] 3D-глобус полный экран, никаких внешних scrollbar.
- [ ] Карточка счёта: НЕТ подписи «Бухгалтерский баланс». Сумма и chip ±vs floor в одной строке.
- [ ] «В ПОЛЁТЕ · N тр-ций» — N совпадает с числом анимирующихся самолётов для этого счёта (проверить по 2-3 счетам).
- [ ] Rail Reliability card: только rail / % / dots. Колонки T+0 нет.
- [ ] Правая колонка карточек скроллится отдельно.

### `/autopilot` (Demo ON)
- [ ] Можно прокрутить вниз — видны все секции: Active alerts → Queue → Recently executed → Skipped → Open alerts.
- [ ] FX badge на карточках НЕТ.
- [ ] Под FX-карточкой — реальная конверсия в виде `KZT 350,000 → EUR 770 @ 0.0022 KZT/EUR` (амбер шрифт, тонкая полоска слева).
- [ ] Тексты не прижаты к краям, контраст лейблов читаемый.
- [ ] Под секцией «Открытые алерты» — серая пояснительная строка.
- [ ] При клике Execute → Confirm на любой карточке: на radar (открыть в новой вкладке) видно фиолетовый самолёт с правильной траекторией.

### `/timemachine`
- [ ] Можно прокрутить вниз — видны все 9 карточек счетов.
- [ ] BASELINE MIN / STRESS MIN / DELTA на каждой карточке: валюта + сумма в одной строке, не обрезано (compact только для миллионов+).
- [ ] Methodology accordion раскрывается, все строки читаются.
- [ ] Если applied=false и локаль RU: видно «Не применено: по этому рельсу для счёта нет входящих транзакций» (весь текст русский).
- [ ] Если `new_breach_count === 0` после прогона — показывается серая пояснительная строка.

### Финальная проверка
- [ ] `npx tsc --noEmit` — clean (0 ошибок).
- [ ] `npm run build` — успех.
- [ ] `grep -r "EUR-Main" frontend/src` — должно быть пусто (только `displayAccountLabel`).
- [ ] `grep -r "account.ledgerBalance" frontend/src` — должно быть пусто после P1.1.
- [ ] `grep -r "action.fxBadge" frontend/src` — должно быть пусто после P2.1.
- [ ] `grep -rn "EUR-Frankfurt\|EUR-Main\|USD-Correspondent\|GBP-Local\|EUR-Berlin\|USD-LA\|CHF-Zurich\|JPY-Tokyo\|SGD-Singapore\|KZT-Almaty" frontend/src/components frontend/src/app` — каждое попадание должно быть либо в `displayAccountLabel(...)`, либо в data-объекте координат towers, либо в storybook/тесте.
- [ ] Commit:
  ```
  polish(ui): real flight counts, FX preview, scrolling, i18n lockstep

  - P0.1 restore vertical scrolling on landing/autopilot/timemachine
  - P0.2 revert time-machine over-truncation; compact only for millions+
  - P0.3 translate stress-result reason in result-card (no mixed RU/EN)
  - P1.1 account-card: drop "Ledger balance" label, inline chip with balance
  - P1.2 account-card: in-flight count/sum filtered by value_date >= today
  - P1.3 radar: drop T+0 expected_delay_range column
  - P1.4 layout: drop "SYSTEM ONLINE" indicator (keep LP avatar)
  - P2.1/2 autopilot: drop FX badge; render real FX conversion preview
  - P2.3 autopilot: bump section padding; remove width clamp on amount
  - P2.4 autopilot: hint copy under "Open alerts" info section
  - P3 NEW execute-event store; violet plane on radar; status indicator
  - P4 lift minor copy ambiguities; clarify volume_spike label
  ```
- [ ] Push в `main` напрямую (`git push origin main`).

---

## Что НЕ делать
- НЕ создавать feature-branch / Pull Request. Один коммит → push в `main`.
- НЕ менять backend (`backend/app/services/liquidity/*`, `backend/app/routers/*`).
- НЕ менять контракт API (`Account`, `Transaction`, `Alert`, `TransferSuggestion`, `AccountStressResult`).
- НЕ переписывать `globe-3d.tsx` / `world-map.tsx` с нуля — добавить второй loop для execute-плашек поверх существующих, не сломав обычные.
- НЕ удалять секцию «Открытые алерты» (P2.4) — она нужна, просто добавить пояснение.
- НЕ удалять `expected_delay_range` из типа API — только UI колонку.
- НЕ ставить `--max-warnings=0` в lint. CI Vercel валит только на errors, на warnings — нет.
- НЕ использовать `any` / `getattr`-стилевые workarounds. Все типы строгие.

Если найдёшь конфликт — пиши в коммит-сообщение что и почему не сделал. Лучше 16 пунктов из 17 сделанных аккуратно, чем 17 на отъебись.
