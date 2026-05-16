# Промпт для агента-кодера — Phase 5: Bank Contagion

> Скопируй блок ниже целиком и вставь агенту (Kimi / Opus / Devin / Claude Code). Промпт самодостаточный: содержит контекст, чёткие требования, точные пути к файлам, формат API и список приёмки.

---

## Контекст

Репо: `https://github.com/moukpu/LiquidPilot` — это predictive liquidity cockpit для SynergyX Hackathon 2026. Backend = FastAPI + uv (Python 3.11), frontend = Next.js 14 App Router + Tailwind + shadcn/ui + framer-motion. Три из четырёх фич готовы (`/radar`, `/autopilot`, `/timemachine`). Сейчас нужно реализовать **Phase 5 — Bank Contagion**.

Сейчас в репо:

- Backend: `backend/app/api/routes/contagion.py` содержит только заглушку `GET /contagion/ -> {}`.
- Frontend: `frontend/src/app/(dashboard)/contagion/page.tsx` содержит только `<h1>+<p>` со stub-текстом.

Зависимости уже стоят: `networkx>=3.4` (бэк), framer-motion + lucide-react + three (фронт — но для Contagion **three не нужен**, делаем 2D).

Зарезервированные имена ключей i18n (для будущего слоя локализации): `nav.contagion`, `stub.contagion.*` (последние удалить после реализации).

## Что построить

Страница `/contagion` показывает направленный взвешенный граф контрагентов: 9 наших счетов (как «свои» узлы) + 6–10 синтетических банков-контрагентов (как «внешние» узлы). Рёбра = экспозиция (USD-эквивалент) от нашего счёта к контрагенту, толщина = размер экспозиции. Когда пользователь кликает на внешний узел и жмёт **«Simulate failure»**, фронт шлёт `POST /contagion/simulate` с `node_id`, бэк возвращает структурированный impact-объект, фронт:

1. Анимирует «волну» риска по графу (BFS от упавшего узла, fade-in красным) с задержкой ~200 мс между уровнями.
2. Показывает справа панель **Impact** с: количеством наших счетов, которые получают breach под стрессом, дельтой total balance (USD), и таблицей per-account delta.
3. Подсвечивает наши счета, у которых под стрессом `stress_min_p50 < min_balance`.

Граф детерминированный — он генерируется один раз на старте (или закешировано), без ML, без обучения. Контрагенты привязаны к реальным городам/странам для согласованности с радаром.

## Контракт API (точно так)

`backend/app/api/routes/contagion.py` должен экспортировать `router` с двумя эндпоинтами:

### `GET /contagion/network`

Без параметров. Возвращает:

```json
{
  "nodes": [
    { "id": "EUR-Main", "type": "internal", "label": "EUR-Main", "country": "DE", "currency": "EUR", "balance_usd": 12960000 },
    { "id": "BNK-DEUTSCHE", "type": "external", "label": "Deutsche Bank", "country": "DE", "tier": 1, "rating": "A+" }
  ],
  "edges": [
    { "source": "EUR-Main", "target": "BNK-DEUTSCHE", "exposure_usd": 4200000, "rail": "SEPA", "direction": "OUT" }
  ]
}
```

- `nodes[].type` ∈ `"internal" | "external"`.
- 9 internal = строго `config.default_system_config().accounts` (id, country, currency, и `balance_usd = current_ledger * FX_RATES_TO_USD[currency]`).
- 6–10 external — детерминированный фикс-набор (Deutsche, JPMorgan, HSBC, UBS, MUFG, DBS, Halyk, плюс при желании Goldman / BNP). У каждого `country`, `tier` (1 ил 2), `rating`. **Список захардкодить в `config.py` рядом с `default_system_config()`** — это конфиг, а не ML.
- Рёбра генерируются детерминированно из `payment_mix` и opening_balance каждого нашего счёта: для каждой пары (internal, external) с пересекающейся страной/валютой добавить ребро с `exposure_usd ≈ opening_balance_usd * weight`, где `weight` зависит от `payment_mix`. **Семя `random_seed=42`** — никакой стохастики между запросами.

### `POST /contagion/simulate`

Body:

```json
{ "node_id": "BNK-DEUTSCHE", "severity": 1.0 }
```

`severity ∈ [0, 1]` = доля экспозиции, которую теряет каждый сосед на BFS-расстоянии 1; на расстоянии 2 — `severity * 0.5`; на расстоянии 3 — `severity * 0.25`. Дальше глубина 3 не идёт.

Ответ:

```json
{
  "failed_node": "BNK-DEUTSCHE",
  "wave": [
    { "depth": 1, "node_ids": ["EUR-Main", "EUR-Berlin"] },
    { "depth": 2, "node_ids": ["BNK-HSBC", "USD-Correspondent"] }
  ],
  "account_impacts": [
    {
      "account_id": "EUR-Main",
      "currency": "EUR",
      "lost_exposure_usd": 4200000,
      "baseline_min_p50": 11200000,
      "stress_min_p50":   7000000,
      "floor":            2160000,
      "new_breach": false
    }
  ],
  "total_delta_usd": -8500000,
  "new_breach_count": 1
}
```

Бизнес-логика:

1. Загрузить граф из `/network`.
2. Сделать BFS от `failed_node` (NetworkX `single_source_shortest_path_length`, обрезать `<= 3`).
3. Для каждого нашего счёта подсчитать `lost_exposure_usd = severity_at_depth * Σ(edges из этого счёта к узлам в волне на этой глубине)`.
4. `stress_min_p50 = baseline_min_p50 - lost_exposure_in_native_currency` (FX обратный из USD по `FX_RATES_TO_USD`).
5. `new_breach = stress_min_p50 < floor and baseline_min_p50 >= floor`.
6. `total_delta_usd = -Σ lost_exposure_usd`.
7. Если `engine_state.state.ready is False` → `HTTPException(503, "Engine warming up")` (как в других роутах).

Baseline берётся из `state.forecasts[account_id].forecast["predicted_ledger_balance_p50"].min()` — точно как делает `radar.py` и `stress.py`.

## Файлы, которые нужно создать/изменить

```
backend/
  app/api/routes/contagion.py         # переписать целиком
  app/services/contagion.py           # NEW — функции build_network() и simulate_failure()
  app/services/liquidity/config.py    # ДОБАВИТЬ default_external_banks() и FX-инверсию
  tests/test_contagion.py             # NEW — pytest для /network и /simulate

frontend/
  src/lib/api.ts                      # ДОБАВИТЬ getContagionNetwork(), simulateContagion()
  src/types/api.ts                    # ДОБАВИТЬ ContagionNetwork, ContagionImpact, etc.
  src/app/(dashboard)/contagion/page.tsx   # переписать целиком
  src/components/contagion/network-graph.tsx   # NEW — SVG-граф с force-layout
  src/components/contagion/impact-panel.tsx    # NEW — правая панель с метриками
  src/i18n/messages/en.ts             # ДОБАВИТЬ ключи contagion.* (и удалить stub.contagion.*)
  src/i18n/messages/ru.ts             # то же
```

**Не трогать:**
- `backend/app/services/liquidity/{data_generator,feature_engineering,forecaster,risk_manager,stress,backtester}.py` — код Азима + stress engine.
- `backend/app/services/engine_state.py` — кеш версий v5, ломать нельзя.
- `frontend/src/components/radar/*`, `frontend/src/components/autopilot/*`, `frontend/src/components/timemachine/*` — готовые фичи.

## Frontend UX requirements

- 2D SVG, **никаких three.js / react-flow** — простой force-directed layout, ручной (D3 force тоже можно, но если боишься размера бандла — реализуй force руками в `useEffect`, ~30 итераций, фиксируй позиции в `useRef`).
- Палитра под текущий «institutional luxury» стиль (см. `frontend/src/app/globals.css`): фон `bg-background`, узлы `internal` = `primary`, `external` = `slate-400`, упавший узел = `rose-500`, волна — постепенно `rose-300 → rose-200 → rose-100` с framer-motion fade-in.
- Размер узла ∝ `log(balance_usd)` для internal, `log(Σ exposure)` для external.
- Толщина рёбер ∝ `log(exposure_usd)`.
- Лейблы — только при hover или на крупных узлах (> 1M USD).
- Клик по external узлу → выделение + появление кнопки «Simulate failure» внизу слева в glass-карточке.
- После симуляции — анимация волны через `setTimeout` с шагом 250 мс на глубину, потом панель Impact плавно появляется справа (как `RadarPage` правый HUD).
- Esc сбрасывает симуляцию и возвращает граф к baseline.
- Локаль: использовать `useT()` из `@/i18n/locale-context` для всех человекочитаемых строк. Цифры — через `formatNumber(value, 0, intl)` из `@/lib/format`.

## Тесты (минимум)

```python
# backend/tests/test_contagion.py
def test_network_shape(client_with_engine):
    r = client_with_engine.get("/contagion/network")
    assert r.status_code == 200
    data = r.json()
    internal = [n for n in data["nodes"] if n["type"] == "internal"]
    external = [n for n in data["nodes"] if n["type"] == "external"]
    assert len(internal) == 9
    assert 6 <= len(external) <= 10
    assert all(e["exposure_usd"] > 0 for e in data["edges"])

def test_simulate_deutsche_hits_eur(client_with_engine):
    r = client_with_engine.post("/contagion/simulate", json={"node_id": "BNK-DEUTSCHE", "severity": 1.0})
    assert r.status_code == 200
    data = r.json()
    affected_ids = [a["account_id"] for a in data["account_impacts"] if a["lost_exposure_usd"] > 0]
    assert "EUR-Main" in affected_ids
    assert data["total_delta_usd"] < 0
```

Использовать существующий fixture стиль из `backend/tests/test_engine.py` (warm_up в фикстуре).

## Acceptance checklist

- [ ] `curl http://localhost:8000/contagion/network` возвращает 9 internal + 6–10 external, рёбер ≥ 12.
- [ ] `curl -XPOST http://localhost:8000/contagion/simulate -d '{"node_id":"BNK-DEUTSCHE","severity":1.0}' -H 'Content-Type: application/json'` возвращает `wave`, `account_impacts`, `total_delta_usd < 0`.
- [ ] `npx tsc --noEmit` в `frontend/` → 0 ошибок.
- [ ] `npm run build` в `frontend/` → success.
- [ ] `uv run pytest` в `backend/` → новые тесты зелёные.
- [ ] Открыть `/contagion` локально → виден граф, клик на «Deutsche Bank» → кнопка «Simulate failure» → анимация волны 1–2 секунды → справа Impact-панель с цифрами и breach-маркерами.
- [ ] При зажатом Esc граф возвращается в baseline.
- [ ] Удалены ключи `stub.contagion.*` и `frontend/src/app/(dashboard)/contagion/page.tsx` больше не использует `useT("stub.contagion.title")`.

## Стиль кода

- Backend: pydantic v2 для request body. Используй `BaseModel` (как в `timemachine.py`). NetworkX импортируется лениво внутри сервиса, чтобы не блокировать boot.
- Frontend: `"use client"` на странице. Все API-вызовы через `apiGet` / `runStressTest`-стиль в `lib/api.ts`. Никаких новых runtime-зависимостей кроме того что уже в `package.json`.
- Не вводи новые env-переменные. CORS уже настроен.

## Out of scope

- Real-time updates / WebSocket — пока polling не нужен, граф статический.
- 3D-рендер графа.
- Сохранение результата симуляции в БД.
- Multi-node failure (только один upstream узел за раз).

## После того как готово

Создай PR в `main`. В описании PR — короткий чек-лист acceptance + скриншот `/contagion` до и после симуляции.
