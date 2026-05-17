# Prompt: Time Machine — fix mechanics + UX bugs

Контекст: репо https://github.com/moukpu/LiquidPilot, ветка `main`, HEAD `cef9347`.

Time Machine на `/timemachine` имеет **критический баг механики bank_holiday** + **5 UX-багов с прошлой итерации**. Зафикси всё одним PR.

---

## БАГ 0 (КРИТИЧНЫЙ — МЕХАНИКА). Bank holiday не монотонен по длительности

**Что наблюдается:** для счёта в KZT 1 день банковского выходного даёт ≈ −19 000 USD ущерба, а 7 дней даёт ≈ −5 000 USD (или вообще зелёная положительная дельта). То есть длиннее простой = меньше ущерба. Это бессмыслица — праздник в платёжной системе не может *улучшать* ликвидность.

**Где сидит баг:** `backend/app/services/liquidity/stress.py`, ветка `if params.scenario == Scenario.BANK_HOLIDAY:` (строки ~246–291).

Сейчас:
```python
out = list(baseline)
flat_value = baseline[0]
for i in range(min(d, n)):
    out[i] = flat_value

accumulated_drift = baseline[d] - flat_value if d < n else 0.0
catch_up = -abs(accumulated_drift) * 1.2
```

Проблемы:
1. **`flat_value = baseline[0]`** — балансы во время праздника замораживаются на **начальном** значении. Если baseline в течение горизонта имеет провал-и-восстановление (типичная картина у KZT-аккаунта: дип на day 1-2, recovery к day 6), длинный праздник *перескакивает* через дип, и stress_min оказывается **выше** baseline_min → положительная дельта.
2. **`accumulated_drift = baseline[d] - baseline[0]`** — это просто куда дрифтанул сам baseline за d дней, а НЕ объём отложенных платежей. На горизонте всего 7 дней при `holiday_days=7` `d` клампится в `n-1=6` → drift почти весь baseline → формула вырождается.
3. Catch-up зависит от знака и формы baseline вместо реальных deferred payments.

**Правильная модель (treasury):**
- Праздник = платёжная система контрагента не процессит платежи.
- Во время праздника **исходящие и входящие** платежи **не списываются и не зачисляются** → баланс стоит на месте.
- Накопленный отложенный отток за d дней = `d * abs(daily_net_outflow)` (из исторических данных счёта).
- На дне +1 после праздника **весь накопленный отток падает одним разом** → большой обрыв.
- Дальше fade обратно к baseline.

**Свойство которое должно держаться:** при увеличении `holiday_days` модуль `delta_min_p50` должен **монотонно расти** (или хотя бы не уменьшаться). Никогда не должно быть `delta_min_p50 > 0` для применённого сценария.

**Что сделать в `stress.py` внутри ветки BANK_HOLIDAY:**

```python
if params.scenario == Scenario.BANK_HOLIDAY:
    if account.country != (params.country or "").upper():
        return list(baseline), {
            "scenario": "bank_holiday",
            "country": params.country or "",
            "holiday_days": params.holiday_days,
            "account_country": account.country,
            "applied": False,
            "reason": "account country doesn't match holiday country",
        }
    d = max(0, min(params.holiday_days, n - 1))
    if d == 0:
        return list(baseline), {
            "scenario": "bank_holiday",
            "country": params.country,
            "holiday_days": 0,
            "applied": False,
            "reason": "holiday_days=0",
        }

    # Empirical daily net outflow for this account (positive = net outflow).
    # Falls back to a tiny floor so monotonicity still holds when history is
    # absent.
    acct_tx = transactions[transactions["account_id"] == account.account_id]
    recent = acct_tx.tail(200)
    sample_days = max(1, int(recent["booking_date"].nunique()))
    out_amt = float(
        recent.loc[recent["direction"] == "OUT", "amount"].sum()
    )
    in_amt = float(
        recent.loc[recent["direction"] == "IN", "amount"].sum()
    )
    daily_net_outflow = max(0.0, (out_amt - in_amt) / sample_days)
    if daily_net_outflow == 0.0:
        # Even a perfectly balanced account loses *something* — settlement
        # friction, FX corridor cost. Use 0.5% of baseline[0] as a floor.
        daily_net_outflow = max(1.0, abs(baseline[0]) * 0.005)

    # Freeze balance during holiday at value just before holiday started.
    # baseline[0] is "today", so day 0..d-1 stay at baseline[0].
    out = list(baseline)
    flat_value = float(baseline[0])
    for i in range(min(d, n)):
        out[i] = flat_value

    # Deferred outflows over d holiday days, all released on day d.
    # AMPLIFICATION accounts for queueing penalty (cut-off windows, extra
    # FX spread for emergency funding). Monotone in d.
    AMPLIFICATION = 1.1
    deferred = d * daily_net_outflow * AMPLIFICATION

    if d < n:
        out[d] = baseline[d] - deferred
        remaining = n - d - 1
        if remaining > 0:
            for i in range(d + 1, n):
                fade = (i - d) / (remaining + 1)
                # Linear recovery — by horizon end we're back on baseline
                out[i] = baseline[i] - deferred * (1.0 - fade)

    return out, {
        "scenario": "bank_holiday",
        "country": params.country,
        "holiday_days": params.holiday_days,
        "flat_value": flat_value,
        "daily_net_outflow": daily_net_outflow,
        "deferred_outflow": deferred,
        "amplification": AMPLIFICATION,
        "sample_size": int(len(recent)),
        "sample_days": int(sample_days),
        "applied": True,
    }
```

Соответственно фронт надо подкрутить под новый набор ключей в `methodology_inputs`.

**В `frontend/src/components/timemachine/result-card.tsx`** в ветке `if (scenario === "bank_holiday")` (строки ~279–301) поменять рендер:

```tsx
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
```

И добавь ключи `timemachine.method.dailyNetOutflow` / `timemachine.method.deferred` в `i18n/messages/en.ts` и `ru.ts`. Удали ключи `flatValue`, `accumulatedDrift`, `catchUp` если их больше нигде не используют (через `rg`).

**Параллельно проверь rail_delay и volume_spike на ту же монотонность** — там я не вижу проблемы (rail_delay вычитает `shift` за каждый из d дней, volume_spike кумулятивно вычитает `extra_per_day`), но прогон тестом не помешает.

---

## БАГ 1 (UX). Дельта может быть положительной для стресса

После фикса БАГ 0 положительной `delta_min_p50` для `applied=True` сценариев **больше не должно быть**. Но на всякий случай:

- В `result-card.tsx` строка ~149: вместо `highlight={result.delta_min_p50 < 0 ? "negative" : "positive"}` поставить `highlight={result.delta_min_p50 < 0 ? "negative" : undefined}` — никакого зелёного для стресса.
- В `timemachine/page.tsx` строки 67–76 (total_delta_usd): аналогично — для стресс-сценариев положительная сумма НЕ green, а neutral.
  ```tsx
  <div className={`text-xl font-bold tabular-nums ${
    result.total_delta_usd < 0 ? "text-rose-500" : "text-muted-foreground"
  }`}>
  ```

---

## БАГ 2 (UX). Хинт «попробуй жёстче … bank_holiday 4d» рассинхронен с тем что юзер запустил

**Где:** `frontend/src/i18n/messages/en.ts:178` и `ru.ts:179`, ключ `timemachine.summary.noBreaches` — там захардкожено «bank_holiday 4d».

**Как чинить:** убрать хардкод из i18n, сделать `summary.noBreaches` шаблоном с параметрами и вычислять предложение на фронте на основе текущих `req.*`.

В `i18n/messages/en.ts`:
```ts
"timemachine.summary.noBreaches": "Stress passed — no account drops below floor. Try harder: {suggestion}.",
```
И параллельно в ru.ts.

В `timemachine/page.tsx` где рендерится `timemachine.summary.noBreaches` сгенерить suggestion динамически:

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
  // bank_holiday
  const next = Math.min(5, (req.holiday_days ?? 2) + 1);
  return `bank_holiday ${next}d`;
}
```

И в рендере: `t("timemachine.summary.noBreaches", { suggestion: harderSuggestion(req) })`.

Если `t()` сейчас не поддерживает параметры — посмотри как сделано в других местах (например в radar или autopilot), там уже есть шаблонная подстановка (`t("...", { foo: bar })`), скопируй паттерн.

---

## БАГ 3 (UX). Спарклайны рисуются для счетов с `applied=false`

**Где:** `result-card.tsx`, строки 78–129. Сейчас даже когда методика говорит «не применено» (например на bank_holiday для счёта в чужой стране), svg всё равно рисует baseline и stress кривые — выглядит как будто стресс что-то посчитал.

**Фикс:** до построения путей проверь:

```tsx
const applied = result.methodology_inputs?.applied !== false;
```

Если `!applied` — вместо svg отрисуй em-dash или одну плоскую линию посередине viewBox в нейтральный цвет (`#cbd5e1`) и **скрой Footer Stat «Δ»** (показывать только Baseline Min и Stress Min, они идентичны).

---

## БАГ 4 (UX). Два больших серых «не применено» блока съедают пол-экрана

**Где:** `timemachine/page.tsx` рендер `result.accounts.map(...)`. Сейчас каждый «не применённый» счёт = такая же 280px+ карточка.

**Фикс:** разделить accounts на два списка — applied и not-applied. Applied рендерить обычной сеткой как сейчас. Not-applied **схлопнуть** в один компактный summary-badge поверх или под сеткой:

```tsx
{notApplied.length > 0 && (
  <div className="mb-3 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs flex items-center gap-2">
    <span className="text-muted-foreground">
      {t("timemachine.notAffected", { count: notApplied.length })}:
    </span>
    <span className="font-mono text-foreground/80">
      {notApplied.map(a => a.account_id).join(", ")}
    </span>
  </div>
)}
```

Добавить i18n ключ `timemachine.notAffected`: "{count} accounts not affected" / "{count} счетов не затронуты".

---

## БАГ 5 (UX). Дельта в заголовке карточки противоречит сумме факторов в Method

С фиксом БАГ 0 это уйдёт само. Но для контроля: после правки бэкенда проверь, что сумма Methodology rows визуально согласуется с `delta_min_p50`. Если расхождение возможно — добавить в Methodology финальную строку «Computed Δ» = `delta_min_p50` и подпись «matches header» / красный warning если нет.

---

## Acceptance

1. **Монотонность:** для **любого** счёта и **любой страны**, при возрастании `holiday_days` с 1 до 5, `abs(delta_min_p50)` **не убывает**. Никогда не появляется положительная дельта.
2. На фронте Δ-цвет: только rose (отрицательная) или нейтральный grey (ноль / не применено / null). Зелёного быть не должно ни в карточке, ни в total bar.
3. Хинт «Try harder» предлагает значение, **строго большее** того что юзер сейчас запустил.
4. Спарклайн на карточках с `applied=false` — плоская линия серого цвета или em-dash, без двух кривых.
5. Список «не затронутых» счетов = один компактный badge, не сетка карточек.
6. `npm run lint` зелёный (после фикса peer-deps в предыдущем PR).
7. `npm run build` зелёный.
8. Бэкенд `pytest backend/tests/` зелёный. Если нет теста на монотонность — **добавить**:

```python
# backend/tests/test_stress.py
def test_bank_holiday_monotonic(engine_ready):
    from app.services.liquidity.stress import apply_scenario, StressParams, Scenario
    from app.services.liquidity.config import default_system_config
    cfg = default_system_config()
    prev = 0.0
    for d in range(1, 6):
        params = StressParams(
            scenario=Scenario.BANK_HOLIDAY,
            country="KZ",
            holiday_days=d,
        )
        res = apply_scenario(
            baseline_forecast=engine_ready.forecasts,
            accounts_config=cfg,
            transactions=engine_ready.transactions,
            params=params,
        )
        # Take only KZ-affected accounts that were applied
        affected = [a for a in res.accounts
                    if a.methodology_inputs.get("applied") is True]
        assert affected, f"day {d}: no applied accounts"
        for a in affected:
            assert a.delta_min_p50 <= 0.001, (
                f"day {d} {a.account_id}: positive delta {a.delta_min_p50}"
            )
        worst = sum(a.delta_min_p50 for a in affected)
        assert worst <= prev + 0.001, (
            f"non-monotonic: d={d} worst={worst} vs prev={prev}"
        )
        prev = worst
```

Не трогать:
- `backend/app/services/liquidity/forecaster.py`, `mock_data.py`, `risk.py` (код Азима, не Stress).
- Версии `next`, `react`, `react-dom`.

**PR title:** `fix(timemachine): bank holiday monotonicity + delta color + dynamic hint + collapsed not-applied`

В описании PR показать:
- скрин «1d vs 5d» KZT-аккаунта с правильной монотонностью
- скрин что на «applied=false» счёте спарклайн плоский
- скрин что 5 счетов не в KZ собраны в один badge
