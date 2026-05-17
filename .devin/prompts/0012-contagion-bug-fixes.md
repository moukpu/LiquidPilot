# 0012 — Contagion: 4 точечных бага после design-review

**Status:** GENERATED 2026-05-17 11:43 UTC. HEAD on main when drafted: `4333ccd` (docs-only over `8e7a235` `0d5473d`). Codepaths verified against this HEAD.
**Source:** design-review thread `/home/ubuntu/contagion-design-review.md` (attached в чате 11:35 UTC). 5 проблем найдено, 4 фиксим в этом PR. 5-ая (cold-start `opening_balance` → отрицательные баланса до warm-up) — отдельная история, не в scope.
**Не трогать** scope этого PR: see «Не трогать» внизу.

## Что чиним

| # | Класс | Где | Что не так | Как чинить |
|---|-------|-----|------------|------------|
| 1 | Real bug (backend) | `backend/app/services/liquidity/contagion.py:308` | Source-узел протекает в `affected` через reverse-рёбра фикстуры. | В BFS-loop добавить `continue` если `neighbour == shocked_account_id`. |
| 2 | Semantic bug (backend) | `backend/app/services/liquidity/contagion.py:336` | `breached = post < min` без проверки baseline. Счёт который **уже** под минимумом получает `breached=true` даже при intensity=0. | `breached = (post < min) and (current >= min)`. |
| 3 | Cosmetic bug (frontend) | `frontend/src/components/contagion/result-panel.tsx:94` + `frontend/src/lib/format.ts` | Хардкоженный литерал `-$` рендерит `-$0` когда loss=0. | Новый helper `formatLoss()` в `lib/format.ts`. Подставить его на стр. 94 + добавить в импорт стр. 4. |
| 4 | UX footgun (frontend) | `frontend/src/components/contagion/shock-form.tsx:95` | Кнопка «Запустить каскад» активна при intensity=0%. | `disabled={loading \|\| value.intensity === 0}`. |

Тесты: добавляем **3 новых invariant'a** в `backend/tests/test_contagion.py` (по одному на баги 1, 2 и общий zero-intensity case). Существующие 6 тестов должны остаться зелёными.

---

## Backend — баг #1: source не должен попадать в affected

### Симптом

```
$ curl -s https://liquidpilot.up.railway.app/contagion/simulate \
  -X POST -H 'content-type: application/json' \
  -d '{"shocked_account_id":"EUR-Main","intensity":1.0,"horizon_days":7}' \
  | jq '.affected[] | .account_id'
"EUR-Berlin"
"GBP-Local"
"USD-Correspondent"
"CHF-Zurich"
"EUR-Main"          # ← source сам в списке. Он не должен тут быть.
"USD-LA"
"KZT-Almaty"
"SGD-Singapore"
"JPY-Tokyo"
```

### Root cause

Фикстура `backend/app/fixtures/contagion_exposures.json` содержит 5 reverse-пар (как и должна — sweep'ы это естественно bidi):

- `EUR-Berlin → EUR-Main` ↔ `EUR-Main → EUR-Berlin`
- `CHF-Zurich → EUR-Main` ↔ `EUR-Main → CHF-Zurich`
- `JPY-Tokyo ↔ SGD-Singapore`
- `USD-Correspondent ↔ USD-LA`
- `EUR-Main ↔ GBP-Local`

BFS на hop 0 ходит по out-edges shocked-узла (например, `EUR-Main → EUR-Berlin`) и атакует соседей. На hop 1 BFS из `EUR-Berlin` ходит по его out-edges и натыкается на `EUR-Berlin → EUR-Main` — пишет `losses[EUR-Main] += exposure × intensity × HOP_DECAY`. Source попадает в `affected` с `hops_from_shock=1`, contributors из своих же соседей. Это бессмыслица: source **сам** причина шока, его потери не моделируются этим алгоритмом.

### Fix

`backend/app/services/liquidity/contagion.py`, в функции `simulate_cascade`, BFS-цикл (строки 301–323). Прямо после строки 308 (`for _, neighbour, data in g.out_edges(node, data=True):`) добавить ранний `continue`:

**Было (строки 308–315):**

```python
            for _, neighbour, data in g.out_edges(node, data=True):
                edge_key = (node, neighbour, hop)
                if edge_key in visited_edges:
                    continue
                visited_edges.add(edge_key)
                edge_loss = data["exposure_usd"] * intensity * atten
                losses[neighbour] = losses.get(neighbour, 0.0) + edge_loss
                contributors.setdefault(neighbour, []).append(node)
```

**Стало:**

```python
            for _, neighbour, data in g.out_edges(node, data=True):
                # Reverse edges in the fixture (e.g. EUR-Berlin → EUR-Main)
                # would otherwise leak the shocked node into ``affected``
                # at hop=1 with contributors=[its own neighbours]. The
                # source is the *cause* of the shock — it does not absorb
                # its own loss in this model. Hard-skip it.
                if neighbour == shocked_account_id:
                    continue
                edge_key = (node, neighbour, hop)
                if edge_key in visited_edges:
                    continue
                visited_edges.add(edge_key)
                edge_loss = data["exposure_usd"] * intensity * atten
                losses[neighbour] = losses.get(neighbour, 0.0) + edge_loss
                contributors.setdefault(neighbour, []).append(node)
```

Никаких других правок в BFS не нужно. `hops_from_shock[shocked_account_id] = 0` уже инициализирован на строке 292 как «source виден сам себе на hop=0» — оставь так, на frontend это нигде не рендерится, а BFS-логика на этом инициализаторе строится.

---

## Backend — баг #2: breach с учётом baseline

### Симптом

`USD-LA` имеет `opening_balance = -113_244` (см. `backend/app/services/liquidity/config.py` или просто из снапшота `current_balance_usd = -113244`). До warm-up balance = opening_balance → счёт уже под `min_balance`. Запрос:

```
$ curl -s https://liquidpilot.up.railway.app/contagion/simulate \
  -X POST -H 'content-type: application/json' \
  -d '{"shocked_account_id":"EUR-Main","intensity":0.0,"horizon_days":1}' \
  | jq '.affected[] | select(.breached) | {id: .account_id, post: .post_shock_balance_usd, min: .min_balance_usd, loss: .incoming_loss_usd}'
{"id":"USD-LA","post":-113244,"min":0,"loss":0}
{"id":"KZT-Almaty","post":-XXXX,"min":YYYY,"loss":0}
```

`intensity=0` → нулевой loss → нулевой ущерб от каскада. Но счёта помечены `breached=true`, потому что их `post == current < min` независимо от шока. False positive — «пробой из-за шока» хотя пробой был **до**.

### Root cause

`backend/app/services/liquidity/contagion.py:325-339`, в построении `affected`:

```python
    affected: List[CascadeHop] = []
    for account_id, loss in losses.items():
        node = nodes_map[account_id]
        post = node.current_balance_usd - loss
        affected.append(
            CascadeHop(
                account_id=account_id,
                hops_from_shock=hops_from_shock[account_id],
                incoming_loss_usd=loss,
                post_shock_balance_usd=post,
                min_balance_usd=node.min_balance_usd,
                breached=post < node.min_balance_usd,             # ← вот тут
                contributors=sorted(set(contributors.get(account_id, []))),
            )
        )
```

### Fix

Заменить строку 336:

**Было:**

```python
                breached=post < node.min_balance_usd,
```

**Стало:**

```python
                breached=(
                    post < node.min_balance_usd
                    and node.current_balance_usd >= node.min_balance_usd
                ),
```

Семантика: «breached» = «счёт был выше минимума **до** шока **и** ушёл ниже **после**». Если счёт был underwater и так — это другая проблема (cold-start / baseline ликвидность), её отображает отдельный модуль (`/risk`), не контагион.

`breached_count` и `total_loss_usd` на строках 348–349 автоматически подхватят новый булеан — ничего больше править не нужно.

---

## Frontend — баг #3: `formatLoss()` helper

### Симптом

На скрине у owner'а (intensity=0%, EUR shocked) result-panel рендерит 4 карточки с «−$0 млн» / «−$0M». Источник — литерал `-$` перед `formatMoneyCompact(loss)`.

### Fix

**Шаг 3a.** В `frontend/src/lib/format.ts` после функции `formatMoneyCompact` (после строки 52) добавить новую экспортированную функцию:

```typescript
/**
 * Compact-format a loss amount with proper sign handling. A loss of 0
 * renders without the `-` prefix (otherwise `-$0` reads as a bug). A
 * positive loss always carries the leading minus — it is money
 * *leaving* the account, that's the convention the result panel uses.
 * Negative inputs are treated as zero (we never display a "positive
 * loss" — that would be cash *gained* and the cascade does not model
 * that).
 */
export function formatLoss(
  amountUsd: number,
  locale: IntlLocale = "en-US"
): string {
  if (amountUsd <= 0) return `$${formatMoneyCompact(0, locale)}`;
  return `-$${formatMoneyCompact(amountUsd, locale)}`;
}
```

**Шаг 3b.** В `frontend/src/components/contagion/result-panel.tsx`:

- **Строка 4:**

  ```typescript
  import { displayAccountLabel, formatMoneyCompact } from "@/lib/format";
  ```

  →

  ```typescript
  import { displayAccountLabel, formatMoneyCompact, formatLoss } from "@/lib/format";
  ```

- **Строки 92–96:**

  **Было:**

  ```tsx
              <Stat
                label={t("contagion.result.loss")}
                value={`-$${formatMoneyCompact(hop.incoming_loss_usd, intl)}`}
                tone="rose"
              />
  ```

  **Стало:**

  ```tsx
              <Stat
                label={t("contagion.result.loss")}
                value={formatLoss(hop.incoming_loss_usd, intl)}
                tone={hop.incoming_loss_usd > 0 ? "rose" : "neutral"}
              />
  ```

  Заодно фикс tone: при loss=0 розовый цвет даёт ложный сигнал «потеря» — нейтральный честнее.

`total_loss_usd` в верхней Metric-плашке (строка 56) тоже стоит привести к `formatLoss(result.total_loss_usd, intl)` для консистентности, **но** там сейчас формат `$X` без минуса (это совокупный убыток, и так понятно что это убыток). Тon = `"rose"` оставь. Это **необязательно** — фикс прежде всего про per-hop карточки. Если правишь top-level Metric, поменяй на:

```tsx
        <Metric
          label={t("contagion.result.totalLoss")}
          value={
            result.total_loss_usd > 0
              ? `-$${formatMoneyCompact(result.total_loss_usd, intl)}`
              : `$${formatMoneyCompact(0, intl)}`
          }
          tone={result.total_loss_usd > 0 ? "rose" : "neutral"}
        />
```

(Хочешь — пропусти, не блокер.)

---

## Frontend — баг #4: кнопка disabled при intensity=0

### Симптом

Дефолт формы на странице — `intensity=1.0`, но если пользователь крутит слайдер до 0% — кнопка остаётся активной. Клик → backend возвращает пустой каскад (`affected=[]`, `total_loss_usd=0`) → result-panel рендерит пустые карточки.

### Fix

`frontend/src/components/contagion/shock-form.tsx`, строка 95:

**Было:**

```tsx
        disabled={loading}
```

**Стало:**

```tsx
        disabled={loading || value.intensity === 0}
```

Существующий класс `disabled:opacity-50` уже даёт визуальный сигнал. Tooltip / textovaya подсказка не нужны — opacity-50 + cursor-not-allowed (через Tailwind по умолчанию работает на `<button disabled>`) достаточно.

---

## Тесты

Добавить в `backend/tests/test_contagion.py` **в конец файла** три новых теста. `engine_ready` fixture уже определён в `backend/tests/conftest.py` и используется существующими тестами — переиспользовать его, новых fixture'ов не нужно.

```python
def test_source_not_in_affected(engine_ready):
    """The shocked node never appears in its own affected list.

    Reverse edges in the fixture (e.g. ``EUR-Berlin → EUR-Main``) would
    otherwise leak the source back at hop=1 with contributors made of
    its own neighbours, which is semantically nonsense — the source is
    the cause of the shock, it does not absorb its own loss.
    """
    for shocked in ("EUR-Main", "USD-Correspondent", "JPY-Tokyo"):
        result = simulate_cascade(
            shocked_account_id=shocked,
            intensity=1.0,
            horizon_days=7,
            daily_balances=engine_ready.daily_balances,
        )
        affected_ids = {h.account_id for h in result.affected}
        assert shocked not in affected_ids, (
            f"shocked {shocked} leaked into affected via reverse edges"
        )


def test_zero_intensity_produces_no_loss(engine_ready):
    """intensity=0 → zero total loss → zero shock-induced breaches.

    Accounts already below their floor before the shock are NOT counted
    as breached by the cascade — that's a pre-existing condition, not
    contagion. ``breached_count`` must therefore be zero when the shock
    contributes zero loss.
    """
    result = simulate_cascade(
        shocked_account_id="USD-Correspondent",
        intensity=0.0,
        horizon_days=7,
        daily_balances=engine_ready.daily_balances,
    )
    assert result.total_loss_usd == 0.0
    assert result.breached_count == 0
    for hop in result.affected:
        assert hop.incoming_loss_usd == 0.0
        assert hop.breached is False


def test_breach_requires_healthy_baseline(engine_ready):
    """A node already underwater pre-shock is NOT 'breached by contagion'.

    For every node flagged ``breached=True`` in a non-trivial shock, the
    pre-shock balance (= ``post_shock_balance_usd + incoming_loss_usd``)
    must be at or above ``min_balance_usd``. Otherwise the breach is a
    pre-existing condition surfaced by accident.
    """
    result = simulate_cascade(
        shocked_account_id="USD-Correspondent",
        intensity=1.0,
        horizon_days=7,
        daily_balances=engine_ready.daily_balances,
    )
    breached_hops = [h for h in result.affected if h.breached]
    assert breached_hops, "expected at least one breach under full hub shock"
    for hop in breached_hops:
        pre_shock_balance = hop.post_shock_balance_usd + hop.incoming_loss_usd
        assert pre_shock_balance >= hop.min_balance_usd, (
            f"{hop.account_id} marked breached but pre-shock balance "
            f"{pre_shock_balance:.2f} was already below floor "
            f"{hop.min_balance_usd:.2f}"
        )
```

---

## Acceptance

### Local — backend

```
cd backend
uv run pytest tests/test_contagion.py -q
```

Все **9** тестов passed (6 старых + 3 новых).

```
uv run pytest tests -q
```

Полный backend suite passed (11 + 3 = 14, или сколько там сейчас — никакие НЕ contagion-тесты не должны сломаться).

### Local — frontend

```
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Все три зелёные. **0 новых dependencies** в `package.json`.

### Local — smoke

```
cd backend
uv run uvicorn app.main:app --port 8000
# в другом терминале:
curl -s -X POST http://localhost:8000/contagion/simulate \
  -H 'content-type: application/json' \
  -d '{"shocked_account_id":"EUR-Main","intensity":1.0,"horizon_days":7}' \
  | jq '.affected[].account_id'
```

В списке **НЕТ** `"EUR-Main"`.

```
curl -s -X POST http://localhost:8000/contagion/simulate \
  -H 'content-type: application/json' \
  -d '{"shocked_account_id":"EUR-Main","intensity":0.0,"horizon_days":1}' \
  | jq '{total: .total_loss_usd, breached: .breached_count}'
```

Должно вернуть `{"total": 0, "breached": 0}`.

### Prod (after Railway redeploy)

```
curl -s -X POST https://liquidpilot.up.railway.app/contagion/simulate \
  -H 'content-type: application/json' \
  -d '{"shocked_account_id":"EUR-Main","intensity":1.0,"horizon_days":7}' \
  | jq '.affected[].account_id'
```

В списке **НЕТ** `"EUR-Main"`.

Открыть `https://liquid-pilot.vercel.app/contagion`:

1. Source = EUR-Main, intensity=100%, horizon=7 → result-panel **НЕ** содержит карточку EUR-Main.
2. Source = USD-Correspondent (дефолт), intensity=0% → кнопка «Запустить каскад» **disabled** (opacity-50).
3. Source = USD-Correspondent, intensity=100% → кнопка активна, клик → 5 карточек, в которых loss отображается как «−$X.XM» (а не «−$0»), цвет розовый. Если каскад где-то даёт loss=0 на промежуточном узле — карточка показывает «$0» без минуса, цвет нейтральный.

---

## Не трогать

- `_FIXTURE_PATH`, `HOP_DECAY`, `MAX_HOPS`, `FX_RATES_TO_USD`, `default_system_config()` — калибровка/конфиг. PR должен ограничиться 4 баг-фиксами + 3 тестами.
- `backend/app/services/liquidity/{forecaster,risk,data_generator,feature_engineering,mock_data}.py` — Azim's engine. **`contagion.py` fair game**, остальное — нет.
- `backend/app/services/liquidity/{config,risk_manager}.py` — fair game **только** для enum/payment_mix/rail-table расширений (как сделано в `8e7a235`). В этом PR их **не трогаем** вообще.
- JSON-схему `/contagion/network` и `/contagion/simulate` response — не менять, frontend заточен под текущие поля `ContagionNode` / `CascadeHop` / `CascadeResult`.
- Не редизайнить result-panel layout — только формат loss-значения + tone. UX-редизайн графа / формы / легенды / иерархии result-cards — отдельный thread (route B в design-review).
- `network-graph.tsx`, `contagion-layout.ts`, `page.tsx` (`/contagion`) — не трогать.
- i18n: новых ключей **не нужно**, все строки переиспользуют существующие. Если кажется что нужен новый ключ — значит ты вышел за scope этого PR.
- Не добавлять npm-зависимостей. Не добавлять Python-зависимостей.
- Не писать комментарии-объясняющие-дифф («fix for design review», «previously had a bug»). Комментарии — только в формате «что делает код в целом» (см. блок-комментарий в баге #1 как образец).
- Не амендить и не force-пушить. Один commit на PR.

## PR title

`fix(contagion): drop source from affected + breach-baseline + formatLoss + intensity=0 disables Run`

## PR description

- **Что починили (4 бага из design-review thread):**
  1. **Backend** — source-узел больше не попадает в `affected` через reverse-рёбра графа (BFS теперь hard-skip'ит `neighbour == shocked_account_id`).
  2. **Backend** — `breached` теперь требует чтобы счёт был выше минимума **до** шока. До этого fix'а счёт уже underwater получал false-positive breach при intensity=0.
  3. **Frontend** — новый helper `formatLoss()` в `lib/format.ts` корректно рендерит loss=0 без минуса. Раньше литерал `-$` давал «−$0» на скрине пользователя при intensity=0%.
  4. **Frontend** — кнопка «Запустить каскад» disabled при intensity=0%. Раньше слалось бесполезный пустой запрос.
- **Тесты:** +3 invariant'a в `backend/tests/test_contagion.py` (`test_source_not_in_affected`, `test_zero_intensity_produces_no_loss`, `test_breach_requires_healthy_baseline`). Все 9 тестов passed.
- **Не в scope:** cold-start `opening_balance` → negative current_balance до warm-up. Это отдельная история (Bug №5 в design-review), будет обсуждаться отдельно — не лечится изменением `simulate_cascade`.
- **Before/after на проде:**

  ```
  # before — source leaks into affected
  $ curl ... -d '{"shocked_account_id":"EUR-Main","intensity":1.0,...}' | jq '.affected[] | select(.account_id=="EUR-Main")'
  {"account_id":"EUR-Main", "hops_from_shock":1, "incoming_loss_usd": ...}

  # after
  $ curl ... -d '{"shocked_account_id":"EUR-Main","intensity":1.0,...}' | jq '.affected[] | select(.account_id=="EUR-Main")'
  (empty)
  ```

  + скрин `/contagion` где для EUR-Main с intensity=100% result-panel НЕ содержит карточку EUR-Main, и второй скрин intensity=0% где кнопка disabled.

---

## Lesson for next Devin

- **Reverse-рёбра в bilateral exposure graph — это норма** (sweep'ы естественно bidi: EUR-Berlin отправляет в EUR-Main и наоборот). Поэтому BFS-симулятор каскада должен явно отсекать source из `affected`, иначе он попадает в результат с бессмысленным `hops_from_shock=1` через цикл длины 2.
- **`breached = post < min`** — это не определение breach'а, это определение «underwater». Breach в смысле контагиона = «**стал** underwater **из-за** шока», что = `post < min AND current >= min`. Эту проверку нужно делать каждый раз когда симулятор должен выделить «новые» нарушения относительно baseline'а.
- **Хардкоженные текстовые префиксы в JSX (`-$`, `+`, `$`) — антипаттерн.** Лучше один helper в `lib/format.ts`, который инкапсулирует sign-handling. Тогда «−$0» rendered как баг нельзя пропихнуть синтаксически.
- **Disabled-state кнопок должен включать domain-валидацию**, не только loading-state. `intensity=0` это валидный с точки зрения схемы запрос, но пустой по смыслу — UI должен предотвратить click.
