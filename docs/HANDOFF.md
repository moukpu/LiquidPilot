# LiquidPilot — полный хэндоф (state-of-the-project)

**Дата:** 2026-05-15 23:40 UTC+5 (Астана). Дедлайн сдачи: 20 мая 23:59. Финал: 24 мая, Астана.

---

## 1. Сводка проекта

**LiquidPilot** — это treasury / liquidity cockpit для SynergyX Hackathon 2026.

**Идея (комбо 1+3+4+5):**
1. **Radar / Air Traffic Control** для денежных потоков (визуализация in-flight транзакций)
2. **Autopilot** — автоматический ребаланс между счетами
3. **Bank Epidemiologist** — графовая модель распространения риска
4. **Time Machine** — историческая симуляция кризисов

**Технический стек:**
- Backend: FastAPI + uv + uvicorn, Python 3.11, pydantic v2, xgboost <3.0, pyarrow, pandas, scikit-learn
- Frontend: Next.js + Tailwind + shadcn/ui
- ML: Quantile XGBoost (P05/P50/P95), MockDataGenerator (540 дней, 23 430 транзакций, 3 счёта), RiskManager, walk-forward backtest
- Deploy: Railway (backend, $5 free trial), Vercel (frontend, free)

---

## 2. Ключевые URL и репо

| Что | Куда |
|---|---|
| **GitHub repo** | https://github.com/moukpu/LiquidPilot |
| **Backend (Railway)** | https://liquidpilot.up.railway.app |
| **Frontend (Vercel)** | https://liquid-pilot.vercel.app |
| **Код Азима (исходник)** | `C:\Users\aldiy\Downloads\fintechproject-main` (Windows локально у юзера) |

---

## 3. История коммитов (только основные)

| Фаза | SHA | Сообщение |
|---|---|---|
| Phase 1 | `009cf4f` | initial: scaffold + dockerfile + ci |
| Phase 2.1 | `7e68ec9` | chore: import Azim's liquidity engine |
| Phase 2.2 | `4700f3b` | feat(backend): add engine warm-up and caching |
| Phase 2.3 | `787677f` | feat(backend): implement accounts/transactions/recommendations endpoints |
| Phase 2.4 | `08684ce` | chore(frontend): install shadcn/ui components |
| Phase 2.5 | `a1000ad` | test(backend): add engine integration tests |
| Plan B | **`2302a99`** | **fix(backend): lazy warm_up + explicit logging for Railway** (последний на момент написания) |

**HEAD origin/main = `2302a99`**

---

## 4. Текущая ситуация — что работает, что НЕТ

### ✅ Работает
- GitHub repo живой, все коммиты на месте
- **Frontend на Vercel** живой: https://liquid-pilot.vercel.app/ возвращает 200, рендерит лендинг
- **Backend код** правильный (`backend/app/main.py`, `engine_state.py`, роуты)
- **warm_up Азима работает за 7 секунд на Linux** (на Railway):
  - 3 аккаунта (`EUR-Main`, `USD-Main`, `KZT-Main`)
  - 23 430 транзакций (synthetic over 540 days)
  - 3 forecasts (per-account 7-day P05/P50/P95)
- **Контейнер стартует**: `INFO: Application startup complete.` + `GET /health HTTP/1.1 200 OK` от внутреннего healthcheck

### ❌ Не работает (текущий блокер)
**Все публичные эндпоинты Railway возвращают 502 «Application failed to respond»**, хотя контейнер живой и warm_up прошёл.

**Диагноз:** port mismatch между container и Railway public proxy.

Из Network Flow Logs Railway:
- Контейнер слушает `0.0.0.0:8080` (потому что Railway передаёт `$PORT=8080`)
- Публичный домен `liquidpilot.up.railway.app` шлёт трафик на **другой порт** или **другой адрес**, поэтому возвращает 502 на внешние curl'ы

### Что у юзера в Railway сейчас
- Custom Start Command: `sh -c "uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT"`
- ENV: `CORS_ORIGINS=["https://liquid-pilot.vercel.app","http://localhost:3000"]`
- Healthcheck Path: **скорее всего НЕ установлен `/health`** (юзер не успел подтвердить)
- Healthcheck Timeout: **скорее всего стандартный** (юзер не установил 300)
- Volume: НЕ добавлен (не критично)
- Postgres: НЕ добавлен (не нужен)

### Что у юзера в Vercel сейчас
- ENV: `NEXT_PUBLIC_API_URL=https://liquidpilot.up.railway.app`
- Root Directory: `frontend`
- Deploy успешный, страница рендерится

---

## 5. Что делать СЕЙЧАС чтобы зафиксить 502 (по приоритету)

### Шаг 1. Healthcheck Path
Railway → backend → Settings → раздел **Deploy** или **Healthcheck**:
- **Healthcheck Path** = `/health` (со слешем)
- **Healthcheck Timeout** = `300`
- **Save**

### Шаг 2. Проверить настройку публичного порта
Railway → backend → Settings → **Networking** → раздел **Public Networking**:
- Должен быть Target Port = `8080` (потому что Railway сейчас передаёт `$PORT=8080`)
- Если стоит `8000` → поменять на `8080`, **Save**

Альтернативно (если Networking менять не хочется) — захардкодить порт в Start Command:
```
sh -c "uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"
```
Тогда Railway будет роутить на 8000 и контейнер будет на 8000.

### Шаг 3. Проверить curl

```bash
curl -sk -m 30 https://liquidpilot.up.railway.app/health
curl -sk -m 30 https://liquidpilot.up.railway.app/accounts/
curl -sk -m 30 https://liquidpilot.up.railway.app/transactions/in-flight
curl -sk -m 30 https://liquidpilot.up.railway.app/recommendations/
curl -sk -m 30 https://liquidpilot.up.railway.app/accounts/EUR-Main/forecast
```

**Ожидаемое:**
- `/health` → `{"status":"ok","engine_ready":true,"warmed_at":"...","error":null}`
- `/accounts/` → массив из 3 объектов с балансами
- `/transactions/in-flight` → массив транзакций
- `/recommendations/` → объект с `alerts` и `transfers`
- `/accounts/EUR-Main/forecast` → объект с `forecast` (7 точек P05/P50/P95) и `top_features`

### Шаг 4. Ручной триггер warm_up (на случай если /health показывает engine_ready=false)
```bash
curl -X POST https://liquidpilot.up.railway.app/admin/warmup
```
Это эндпоинт который добавил Kimi в коммите `2302a99` для дебага. Возвращает `{"status":"warmup_triggered","engine_ready_before":false}` и в фоне запускает warm_up.

---

## 6. Что было сделано (хронология)

1. ✅ Phase 1: scaffold, Dockerfile, CI, базовые эндпоинты
2. ✅ Phase 2: интеграция кода Азима, warm_up с кэшированием, endpoints, shadcn компоненты, тесты
3. ✅ Vercel подключён, фронт задеплоен
4. ✅ Railway подключён, env-переменные добавлены, Start Command настроен с `sh -c "...$PORT"`
5. ✅ Plan B (коммит `2302a99`): warm_up стал ленивым, добавлено `logging.basicConfig(force=True, stream=sys.stdout)`, добавлен `POST /admin/warmup` для ручного триггера, добавлен traceback.format_exc() в except
6. ⚠️ Текущий затык: контейнер живой, warm_up прошёл, но публичные curl'ы → 502 из-за port mismatch

---

## 7. Структура репо (для нового агента)

```
LiquidPilot/
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml         (xgboost<3.0, fastapi, uv-managed)
│   ├── app/
│   │   ├── main.py            (FastAPI + lifespan + lazy warm_up в коммите 2302a99)
│   │   ├── config.py
│   │   ├── api/routes/
│   │   │   ├── health.py      (GET /health + POST /admin/warmup)
│   │   │   ├── accounts.py    (GET /, GET /{id}/forecast)
│   │   │   ├── transactions.py (GET /in-flight, GET /recent)
│   │   │   ├── recommendations.py (GET /)
│   │   │   ├── contagion.py   (stub для Phase 5)
│   │   │   └── timemachine.py (stub для Phase 6)
│   │   └── services/
│   │       ├── engine_state.py (state, warm_up)
│   │       └── liquidity/      ← код Азима, не трогать
│   │           ├── config.py
│   │           ├── forecaster.py
│   │           ├── mock_data.py
│   │           ├── risk.py
│   │           └── ...
│   ├── tests/
│   │   └── test_engine.py
│   └── data/cache/             (создаётся на runtime, parquet + pickle)
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    └── src/
        ├── app/page.tsx
        └── components/ui/      (shadcn: button, card, badge, separator, tabs, switch, sheet, alert, table, tooltip)
```

---

## 8. Что после фикса 502 — план фаз

### Фаза 3 — Air Traffic Control / Радар (пункты 6-7)
**Промпт для Kimi/Opus:**
- На фронте создать `/radar` страницу
- Центральная карта мира с тремя «диспетчерскими башнями» (3 счёта: EUR/USD/KZT)
- Транзакции из `/transactions/in-flight` рисуются как **самолётики** летящие от исходящего счёта к целевому
- Цвет самолётика = размер транзакции (зелёный → жёлтый → красный)
- При наведении — тултип с amount, currency, ETA, counterparty
- Polling каждые 2 секунды для свежих данных
- Технологии: React Flow или D3 или canvas — выбрать самое простое для демо

### Фаза 4 — Autopilot UI (пункты 8-9)
- Страница `/autopilot`
- Большая кнопка-переключатель Autopilot ON / OFF
- Когда ON: backend каждые N часов вычисляет рекомендации (`/recommendations/`) и в UI показывается лог «AUTOPILOT: transferred €500K from EUR-Main to USD-Main, reason: …»
- В режиме OFF — рекомендации показываются как cards с кнопкой «Approve» / «Decline»

### Фаза 5 — Bank Epidemiologist (пункты 10-11)
- Страница `/contagion`
- Граф контрагентов (банки + крупные клиенты) — узлы
- Рёбра = чувствительность платежей
- Когда юзер «убивает» узел (delete) — анимация распространения риска по графу с пересчётом ликвидности
- Backend endpoint `/contagion/simulate?node_id=X` возвращает delta по каждому счёту

### Фаза 6 — Time Machine (пункты 12-13)
- Страница `/timemachine`
- Слайдер «март 2023 (SVB)», «декабрь 2008 (Lehman)», «март 2020 (COVID)»
- Перематывает синтетические данные на эти сценарии (бэкенд должен иметь несколько `MockDataGenerator` пресетов)
- Показывает: «Что было бы с нашей ликвидностью если бы это случилось сегодня»

### Фаза 7 — Брендинг + демо-сценарий + финальный деплой (пункты 14-16)
- Логотип, цветовая палитра, лендинг
- 90-секундный демо-сценарий: открыть Radar → увидеть платёж-аномалию → нажать Autopilot → увидеть Time Machine сравнение
- Финальный деплой, smoke test всех URL

### Фаза 8 — Сдача до 20 мая 23:59 (пункты 17-19)
- One-pager PDF
- Демо-видео (3 минуты)
- Сабмит формы хакатона

### Фаза 9 — Финал 24 мая Астана (пункты 20-22)
- Слайды (10-12 штук)
- Живое демо (репетировать 5 раз)
- Q&A заготовки

---

## 9. Промпты, которые я уже отправлял

Все промпты для Kimi/Opus лежат у меня:
- `/home/ubuntu/kimi_phase2_prompt.txt` — Phase 2 (уже отработан)
- `/home/ubuntu/kimi_lazy_warmup_prompt.txt` — Plan B lazy warm_up (отработан, коммит `2302a99`)
- `/home/ubuntu/LiquidPilot_plan.md` — общий план v2
- `/home/ubuntu/friend_code_analysis.md` — анализ кода Азима
- `/home/ubuntu/synergyx_plan.md` — структура хакатона
- `/home/ubuntu/unique_ideas.md` — мозговой штурм

---

## 10. Правила работы (мои ограничения)

- ❌ НЕ пушу на GitHub сам, только читаю
- ❌ НЕ модифицирую settings Railway/Vercel сам, только инструктирую
- ❌ Не работаем с OpenAI ключами — все AI делают сами агенты (Kimi K2.6, Opus 4.7, Gemini)
- ❌ Не трогаю код Азима в `app/services/liquidity/` — он работает, переносим как есть
- ✅ Координирую промпты для агентов
- ✅ Дебажу деплой через curl с моей стороны
- ✅ Читаю логи которые шлёт юзер

---

## 11. Если 502 не уходит после всех фиксов

Запасной вариант:
1. **Удалить сервис в Railway и пересоздать** через New → Deploy from GitHub repo → `moukpu/LiquidPilot`, Root Directory `backend`. Иногда Railway так лечится.
2. **Альтернатива Railway** — Fly.io (free tier, надёжнее с FastAPI). Команда:
   ```bash
   cd backend
   fly launch --no-deploy
   fly deploy
   ```
3. **Локальный демо** в крайнем случае: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` — фронт показывать с экрана ноута на финале.

---

## 12. Срочные контакты / артефакты

- **GitHub:** `moukpu/LiquidPilot`
- **Хакатон:** SynergyX Hackathon 2026
- **Дедлайны:**
  - 20 мая 23:59 — сабмит
  - 24 мая — финал в Астане
- **Команда:** юзер (qwenoob18) + Азим (исходный код движка)
- **AI агенты:** Kimi K2.6 (основной кодер), Opus 4.7 (рефакторинг), Gemini/Stitch (по необходимости)

---

## КОНЕЦ ХЭНДОФА — следующий шаг

1. **Зафиксить 502 на Railway** (Healthcheck Path = `/health`, проверить Target Port в Networking)
2. Когда `curl /accounts/` вернёт массив из 3 счетов с цифрами — переходить к Фазе 3 (Радар)
3. Все промпты Phase 3+ ещё НЕ написаны — нужно сгенерить когда будет время
