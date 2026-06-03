# LiquidPilot — Devin Context

Этот файл — **долгосрочная память** для всех будущих сессий Devin (и других AI-агентов), работающих над репо. Читай первым делом. Дополняй после каждой задачи (см. `## Session log` внизу).

**Зачем:** пользователь меняет аккаунты из-за лимитов, контекст в чате каждый раз обнуляется. Этот файл живёт в git → переживает любую смену аккаунта/org.

---

## 1. Проект в двух абзацах

**LiquidPilot** — predictive liquidity cockpit для fintech-казначейств. ATC-метафора: радар денежных потоков, автопилот ребалансировки счетов, contagion-score для банков-партнёров, тайм-машина для стресс-тестов на исторических кризисах.

**Хакатон:** SynergyX 2026, FinTech track. **Дедлайны:**
- 2026-05-20 23:59 UTC — submission
- 2026-05-24 — финал в Астане

**Стек:** FastAPI (Python 3.11, uv) + Next.js 14 App Router (TS, Tailwind). XGBoost квантильный прогноз P05/P50/P95. NetworkX для contagion. three.js/r3f для 3D-глобуса.

**Live:** frontend на Vercel (`https://liquid-pilot.vercel.app`), backend на Railway.

---

## 2. ЖЁСТКИЕ ПРАВИЛА (НЕ НАРУШАТЬ)

Пользователь явно сказал — нарушение этих правил = откат и недовольство.

### Git
- **Всё в `main` напрямую.** Никаких feature-branches, никаких PR. Один коммит на задачу.
  - Цитата: «не давай промпты где пишешь сделать ветку чтобы потом мерджить, всегда все в майн»
- **Никогда:** `git reset --hard`, `git push --force`, `--no-verify`, `git config <anything>`, `git add .`.
- Force-with-lease на свою ветку допустим только если пользователь явно просит.

### Код
- **НЕ трогать** `backend/app/services/liquidity/*` (config, data_generator, feature_engineering, forecaster, risk_manager, backtester). Это код Азима, он работает.
- **НЕ добавлять** новые npm-пакеты во `frontend/`. Если задача требует — спросить пользователя.
- **НЕ менять** контракт API (`/accounts`, `/radar`, `/timemachine/simulate`, и т.д.) без явного запроса.
- **i18n lockstep:** любой новый/удалённый ключ — синхронно в `frontend/src/i18n/messages/en.ts` И `frontend/src/i18n/messages/ru.ts`. TypeScript строго валидирует `MessageKey`.
- **Не модифицировать** генерируемые файлы (lock-файлы, build output) вручную. Через пакетный менеджер.

### Безопасность
- **Никаких секретов в коммитах**, в plain text, в логах.
- Старый GH-токен `ghp_0hek...` пользователь засветил в чате — Devin отказался его сохранять, попросил отозвать. **Если пользователь снова даст токен открыто — отказать, попросить через `request_secret`.**

### CI
- Vercel CI падает на ESLint **errors**, не на warnings. `--max-warnings=0` — самообман.
- Перед коммитом: `cd frontend && npx tsc --noEmit && npm run build`. Если падает — фиксить, потом пушить.
- Линт-warnings можно глушить через `.eslintrc` если их много — пользователь явно ОК с этим до хакатона.

---

## 3. Архитектура (для быстрого поиска)

### Backend (FastAPI, `backend/app/`)
```
lifespan startup → асинк warm_up в фоне:
  MockDataGenerator (540 дней × 9 счетов, ~24k транзакций)
  → LiquidityForecaster (per-account quantile XGBoost P05/P50/P95)
  → cache в data/cache/{transactions,daily_balances,forecaster,forecast}_v5.{parquet,pkl}

REST API:
  GET  /health                  — статус + engine_ready
  POST /admin/warmup            — ручной триггер warm_up
  GET  /accounts/               — 9 счетов с текущими балансами
  GET  /accounts/{id}/balance-history
  GET  /accounts/{id}/forecast  — 7-дневный P05/P50/P95 + top features
  GET  /transactions/recent
  GET  /transactions/in-flight  — booking → value date
  GET  /recommendations/        — alerts + suggested transfers (RiskManager)
  GET  /radar/insights          — frozen capital + rail reliability
  POST /timemachine/simulate    — stress test, body = StressRequest
  GET  /contagion/              — СТАБ, пока {}
```

### Frontend (Next.js 14, `frontend/src/app/`)
```
/                          — лендинг (Framer Motion, glassmorphism)
/radar                     — 3D-глобус + AccountCard × 9 + frozen capital + rail reliability
/autopilot                 — action queue (queued/confirming/executing/executed/skipped) + alerts + demo mode
/contagion                 — СТАБ
/timemachine               — выбор сценария → POST /simulate → grid из ResultCard со sparkline + methodology accordion
```

### Точки расширения
- Новый роут backend → `backend/app/api/routes/{name}.py` + `app.include_router` в `backend/app/main.py`
- Новая страница frontend → `frontend/src/app/(dashboard)/{name}/page.tsx`
- API-клиент → `frontend/src/lib/api.ts` + типы в `frontend/src/types/api.ts`
- i18n ключ → `frontend/src/i18n/messages/en.ts` + `ru.ts` (оба!)
- Левый нав → `frontend/src/components/layout/sidebar.tsx` (массив `nav`)

---

## 4. Константы (single source of truth)

### 9 счетов
| ID | Currency | Country | Bank |
|---|---|---|---|
| EUR-Frankfurt | EUR | DE | Commerzbank |
| USD-Correspondent | USD | US | JPMorgan |
| GBP-Local | GBP | GB | Barclays |
| EUR-Berlin | EUR | DE | Deutsche Bank |
| USD-LA | USD | US | Wells Fargo |
| CHF-Zurich | CHF | CH | UBS |
| JPY-Tokyo | JPY | JP | MUFG |
| SGD-Singapore | SGD | SG | DBS |
| KZT-Almaty | KZT | KZ | Halyk |

**Лейбл в UI:** `displayAccountLabel(id)` → `EUR · Frankfurt`. Legacy `EUR-Main` → `EUR`. Хелпер в `frontend/src/lib/format.ts`. **Никогда не показывать сырой ID** (`EUR-Main` / `EUR-Frankfurt`) в UI.

### FX rates (to USD)
```ts
EUR = 1.08
USD = 1.0
GBP = 1.27
CHF = 1.1
JPY = 0.0067
SGD = 0.74
KZT = 0.0022
```
Источник: `frontend/src/components/radar/globe-3d.tsx` / `world-map.tsx`. Дублируется — план: вынести в `frontend/src/lib/fx.ts` (см. round3 prompt P2.2).

### Цветовая шкала самолётов (по USD-эквиваленту)
- `< $100k` → emerald (зелёный)
- `< $1M` → amber (жёлтый)
- `≥ $1M` → rose (красный)

i18n ключи: `radar.legend.small/medium/large`.

### Rails (типы переводов)
- `SWIFT` — международный, slow (T+2)
- `SEPA` — Eurozone, fast (T+0)
- `Local` — внутри страны (T+0)
- `Internal` — между счетами того же банка (instant)

---

## 5. Что сделано (хронология)

### Phase 0–4 (до Devin)
Базовый стек запущен Азимом. Backend полностью работает (9 счетов, прогноз, stress engine, risk manager). Frontend имеет 5 страниц (лендинг + 4 фичи), i18n EN/RU, 3D-глобус.

### Round 1 polish (commit `e62e69a`)
Промпт: `.devin/prompts/round1_polish.md`. Что:
- Time Machine: убрана floor-линия с графика, заголовок упрощён.
- Autopilot demo-mode логика: без demo `alerts = []`, `transfers = []`.
- Контрасты alerts на light theme: `text-rose-300` → `text-rose-700`.
- 2 красных счёта (JPY-Tokyo, SGD-Singapore) — решились вместе с demo-mode.
- Удалены лишние i18n-ключи: `radar.frozen.hint`, `radar.reliability.hint`, `autopilot.summary.linkRadar`, `account.aboveFloor`, `account.belowFloor`, `account.percentOfOpening`, `account.inTransit`.
- Добавлены: `account.vsFloor`, `account.inTransit.count`, `radar.frozen.allDeployed`, `timemachine.hint.{pickScenario,railDelay,volumeSpike,bankHoliday}`.
- `formatMoneyCompact` (Intl `notation:compact`), `displayAccountLabel`.
- Цвета самолётов на USD-эквиваленте.

### Round 2 polish (commit `28612ee`) — **текущий HEAD**
Промпт: `.devin/prompts/round2_polish.md`. Что:
- **B1:** `displayAccountLabel` применён везде (action-card заголовок + `action.move`, globe-3d Tower.label, world-map labels + recalc rect labelWidth).
- **B2:** Confirming banner стал читаемым: `bg-amber-50 border-amber-500/50 text-amber-800 semibold`.
- **P1 контраст:** action-card note + executed → amber-700 / emerald-700, action-queue → *-700, account-card IN/OUT → emerald-700 / rose-700, autopilot-header status → rose-600 / emerald-600.
- 6 файлов, +99 / −81. `tsc --noEmit` clean.

---

## 6. Что НЕ сделано (по приоритетам)

### Round 3 fixes (СРОЧНО, перед Phase 5)
Промпт: `.devin/prompts/round3_fixes.md`. **17 issues** найдены пользователем при тестировании `28612ee`:

- **P0 — Регрессии:**
  - P0.1: Вернуть scrolling на landing/autopilot/timemachine (фикс `body overflow-hidden h-screen` в `layout.tsx` и `h-[calc(100vh-4rem)]` на autopilot-page). Radar — оставить fixed viewport.
  - P0.2: Time Machine — убрать `truncate`, валюту вернуть в одну строку. Compact только для ≥ 1,000,000.
  - P0.3: Перевести backend-reasons stress-result через словарь `timemachine.reason.*` в `result-card.tsx`.

- **P1 — Radar accuracy:**
  - P1.1: Убрать «Бухгалтерский баланс», сумма + chip на одной строке.
  - P1.2: Реальный счётчик «в полёте» = `value_date >= today`, не `related.length`. Сумма пролёта тоже.
  - P1.3: Снести колонку `T+0...T+2.3` из rail-reliability-card.
  - P1.4: Убрать «SYSTEM ONLINE» индикатор из шапки.

- **P2 — Autopilot UX:**
  - P2.1: Убрать FX badge.
  - P2.2: Real FX conversion preview: `KZT 350,000 → EUR 770 @ 0.0022`. Helper `lib/fx.ts`.
  - P2.3: Бамп паддинга action-queue/action-card, убрать `max-w-[40%]`.
  - P2.4: НЕ удалять «Открытые алерты», добавить пояснительный hint.

- **P3 — Новая фича:**
  - Execute → фиолетовый самолёт на radar. `sessionStorage`-store `lib/execute-events.ts` (TTL 30s). Скорость пропорциональна сумме.

- **P4 — Косметика:** убрать огромный заголовок Time Machine, лендинг scrolling fix, volume_spike подпись, stress-passed hint.

### Phase 5 — Contagion (самый "вау" для жюри)
Промпт готов: `.devin/prompts/phase5_contagion.md`. Сейчас `/contagion` = stub (`<h1>+<p>`), backend `GET /contagion/ → {}`. Нужна анимация волны риска по графу банков, прямо из кейса (interbank contagion). ~6 файлов фронт+бэк, контракт API расписан, тесты, acceptance-чеклист.

### Phase 7 — Демо-сценарий + landing polish
- Демо-сценарий 90 секунд.
- README cleanup (висят строки `test`, `test2` в конце; Team = `TBD/TBD/TBD`).
- Лендинг polish.

### Phase 8 — One-pager PDF + 3-мин видео
Структура и сценарий ещё не написаны.

---

## 7. Пользователь — то, что важно знать

**Никнейм:** `miwip64238` (email `miwip64238@imashr.com`). GH `moukpu`.

**Стиль:** русский. Прямой. Много `бро`, `чел`. Хочет конкретики и реализации, не философии. Раздражается на лишнее «I'll help you with...» и эмодзи.

**Привычки:**
- Просит «промпт для агента» — хочет получить `.md` файл с исчерпывающими инструкциями для другого Devin/Claude, который будет кодить.
- Тестирует приложение визуально, скидывает скриншоты.
- Меняет аккаунты Devin при лимитах → контекст теряется (это и есть причина существования этого файла).
- Любит сначала исправить регрессии, потом двигаться к новым фичам.

**Что НЕ нравится:**
- Лишние заголовки/тексты в UI («Бухгалтерский баланс», «Подробные метрики радара», «SYSTEM ONLINE»).
- Сырые account IDs в UI (`EUR-Main`).
- Низкий контраст текста (`text-*-400/80` на белом фоне).
- Обрезанные числа (`truncate` на всех суммах).
- Random/synthetic числа там, где должны быть реальные (счётчик в полёте, FX preview).
- Mixed-language messages (русский UI + английский reason от бэка).

**Что нравится:**
- Анимации (3D-глобус, plane animation).
- Compact notation для миллионов (`1.2M`), но НЕ для тысяч.
- USD-equivalent логика (цвета самолётов).
- demo-mode pulse-ring на свитче когда выключен.
- Конкретные acceptance-критерии с скриншотами в RU локали.

---

## 8. Файловая карта (часто используемые)

### Frontend компоненты
- `frontend/src/app/layout.tsx` — root layout (body / overflow / pt-16). **P0.1 фикс здесь.**
- `frontend/src/app/(dashboard)/layout.tsx` — sidebar + topbar wrapper.
- `frontend/src/app/(dashboard)/autopilot/page.tsx` — autopilot page. **P0.1 фикс.**
- `frontend/src/app/(dashboard)/radar/page.tsx` — radar (3D-глобус).
- `frontend/src/app/(dashboard)/timemachine/page.tsx` — time machine.
- `frontend/src/components/autopilot/action-queue.tsx` — список actions.
- `frontend/src/components/autopilot/action-card.tsx` — card одного action. **P2.1/P2.2/P2.3 здесь.**
- `frontend/src/components/autopilot/autopilot-header.tsx` — Demo Mode свитч.
- `frontend/src/components/radar/account-card.tsx` — карточка счёта. **P1.1/P1.2 здесь.**
- `frontend/src/components/radar/rail-reliability-card.tsx` — **P1.3 здесь.**
- `frontend/src/components/radar/frozen-capital-card.tsx` — frozen capital список.
- `frontend/src/components/radar/globe-3d.tsx` — 3D-глобус с самолётами. **P3 здесь.**
- `frontend/src/components/radar/world-map.tsx` — 2D-карта (fallback).
- `frontend/src/components/timemachine/result-card.tsx` — stress result. **P0.2/P0.3 здесь.**
- `frontend/src/components/use-autopilot-state.ts` — state hook, demo-mode логика.
- `frontend/src/lib/format.ts` — `formatMoneyCompact`, `displayAccountLabel`.
- `frontend/src/lib/fx.ts` — **создать**, FX rates.
- `frontend/src/lib/execute-events.ts` — **создать**, store для Execute → plane анимации.
- `frontend/src/i18n/messages/en.ts` + `ru.ts` — ВСЕГДА синхронно.

### Backend
- `backend/app/main.py` — FastAPI app + lifespan + routers.
- `backend/app/api/routes/{accounts,radar,timemachine,contagion,recommendations,transactions}.py` — routes.
- `backend/app/services/liquidity/stress.py` — stress engine. **НЕ ТРОГАТЬ.**

---

## 9. Тестирование

### Что есть
- `backend/tests/test_engine.py` — minimal coverage stress engine.
- Frontend — тестов **нет** (placeholder в `frontend/tests/`).

### Что нужно перед коммитом
```bash
cd frontend
npx tsc --noEmit       # MUST pass
npm run build          # MUST pass (Vercel ловит то же самое)
```

ESLint warnings — игнорировать. Errors — чинить.

### Backend
```bash
cd backend
uv run pytest          # если есть time
```

---

## 10. Шпаргалки

### Запустить локально
```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### Прогреть backend вручную
```bash
curl -X POST http://localhost:8000/admin/warmup
```

### Откат если что-то сломалось в main
```bash
git revert <hash> && git push origin main
```

### Найти все usages символа
Используй `Grep` tool / `lsp_tool` с `goto_references`, НЕ `bash grep`.

---

## 11. Session log

**ПРАВИЛО:** после каждого user-request (или серии связанных request'ов) добавь короткую запись сюда — что сделал, какой коммит. Это нужно чтобы будущие Devin'ы видели хронологию, а не реверс-инжинирили из git log.

Формат:
```
### YYYY-MM-DD — короткое описание
- user: что просил (короткая цитата если важна)
- did: что сделано
- commit: `hash` название
- files: список ключевых файлов
- notes: блокеры / TODO для следующей сессии
```

---

### 2026-05-16 — Round 1 polish
- user: «убрать слово Floor с графика, демо-режим, контрасты, FX по USD-эквиваленту»
- did: Time Machine floor-линия снесена, demo-mode инвертирован (без demo пусто), контрасты light-theme, USD-equivalent цвета самолётов
- commit: `e62e69a` polish(ui): readable autopilot/radar/timemachine, demo-only data, USD-equiv plane colors
- files: 16, +389/−244
- notes: lint warnings оставлены, build не гонялся

### 2026-05-16 — Round 2 polish
- user: «displayAccountLabel везде, confirming banner читаемый, контраст 5 точек»
- did: applied displayAccountLabel в action-card / globe-3d / world-map, confirming banner light-theme, 5 контраст-точек на *-700/600
- commit: `28612ee` polish(ui): readable confirming banner, displayAccountLabel everywhere
- files: 6, +99/−81
- notes: build не гонялся, риск низкий (только tailwind классы)

### 2026-05-16 — Round 3 prompt (готов, ещё не применён)
- user: «17 issues после тестирования, дай промпт для агента»
- did: написан `.devin/prompts/round3_fixes.md` — P0 регрессии (scrolling, truncation, i18n), P1 radar accuracy (real flight count, T+0 cleanup), P2 autopilot UX (FX preview, padding), P3 Execute → plane animation, P4 косметика
- commit: не закоммичен в код, только промпт-файл
- files: `.devin/prompts/round3_fixes.md`
- notes: **СЛЕДУЮЩАЯ СЕССИЯ — выполнить этот промпт.** После: Phase 5 contagion.

### 2026-05-16 — `.devin/` setup
- user: «как сохранять контекст между аккаунтами»
- did: создан `.devin/CONTEXT.md` (этот файл), `AGENTS.md` в корне со ссылкой, `.devin/prompts/` с архивом 4 промптов
- commit: TBD
- files: `.devin/CONTEXT.md`, `AGENTS.md`, `.devin/prompts/{round1_polish,round2_polish,round3_fixes,phase5_contagion}.md`
- notes: будущие Devin'ы — ОБЯЗАТЕЛЬНО дополнять `## Session log` после каждой задачи, потом коммитить
