# 0011 — Contagion fixture path: fix Railway 500

**Status:** GENERATED 2026-05-17 11:17 UTC. HEAD on main when drafted: `1911435`.
**Symptom:** на проде `/contagion` показывает «Не удалось загрузить граф контагиона с бэкенда». `curl https://liquidpilot.up.railway.app/contagion/network` → `HTTP 500 Internal Server Error`. Локально pytest зелёный — баг видно только в Docker-сборке.

## Root cause

`backend/app/services/liquidity/contagion.py:57-62`

```python
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[4]
    / "data"
    / "fixtures"
    / "contagion_exposures.json"
)
```

- **Локально** `<repo>/backend/app/services/liquidity/contagion.py` → `parents[4]` = `<repo>` → `<repo>/data/fixtures/contagion_exposures.json` существует, всё работает.
- **На Railway** `backend/Dockerfile`:

  ```
  WORKDIR /app
  COPY pyproject.toml ./
  COPY app/ ./app/
  ```

  Build context — `backend/` (так настроен `railway.toml` + `dockerfilePath = "Dockerfile"`). В образе контейнера `contagion.py` лежит по пути `/app/app/services/liquidity/contagion.py`, и `parents[4]` = `/`. `_FIXTURE_PATH` уходит в `/data/fixtures/contagion_exposures.json` — этого файла в образе нет (директорию `data/` Dockerfile не копирует, и не может — она вне build context).

  `load_exposures()` падает с `FileNotFoundError`, в `routes/contagion.py:30-39` нет try/except → FastAPI возвращает 500. Эндпоинт `POST /contagion/simulate` ломается по той же причине.

## Fix

Минимальный diff: перенести фикстуру внутрь backend-tree (внутри Docker build context) и подвязать путь по `__file__` так, чтобы он работал и локально, и в контейнере.

### Файлы

| # | Файл | Действие |
|---|------|----------|
| 1 | `data/fixtures/contagion_exposures.json` | `git mv` → `backend/app/fixtures/contagion_exposures.json` |
| 2 | `backend/app/services/liquidity/contagion.py` | UPDATE `_FIXTURE_PATH` + docstring |

Никакие другие файлы трогать не нужно. Тесты (`backend/tests/test_contagion.py`) ходят через `load_exposures()` и `network_snapshot()` — путь резолвится внутри `contagion.py`, тесты заработают сами.

### Шаг 1 — `git mv` фикстуры

```
git mv data/fixtures/contagion_exposures.json backend/app/fixtures/contagion_exposures.json
```

После этого `data/fixtures/` останется пустым каталогом — удали его, чтобы не оставалось мусора:

```
rmdir data/fixtures
```

(`data/generators/` тоже пустой — НЕ трогай его, это отдельная история.)

### Шаг 2 — `backend/app/services/liquidity/contagion.py`

Заменить блок `_FIXTURE_PATH` (строки ~52-62):

**Было:**

```python
# Fixture path is resolved relative to the repo root so it works
# regardless of the process cwd (pytest runs from ``backend/``, the
# server runs from the repo root). ``__file__`` is
# ``<repo>/backend/app/services/liquidity/contagion.py`` — four
# parents up takes us to the repo root.
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[4]
    / "data"
    / "fixtures"
    / "contagion_exposures.json"
)
```

**Стало:**

```python
# Fixture path is anchored on ``__file__`` so it resolves correctly
# both in the local dev tree and inside the Railway Docker image
# (build context is ``backend/``, so ``data/`` outside backend is not
# in the image). ``__file__`` is
# ``<root>/backend/app/services/liquidity/contagion.py`` locally and
# ``/app/app/services/liquidity/contagion.py`` in the container — in
# both cases ``parents[2]`` is ``backend/app/`` (or ``/app/app/``).
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "contagion_exposures.json"
)
```

Также в docstring модуля (строки 9-12) поправить ссылку на путь:

**Было:**

```
  * Loads the hand-curated bilateral exposure fixture (see
    ``data/fixtures/contagion_exposures.json``). The fixture is the
```

**Стало:**

```
  * Loads the hand-curated bilateral exposure fixture (see
    ``backend/app/fixtures/contagion_exposures.json``). The fixture is the
```

## Acceptance

1. **Локально:**

   ```
   cd backend
   uv run pytest tests/test_contagion.py -q
   ```

   Все 6 тестов зелёные.

2. **Локально через uvicorn:**

   ```
   cd backend
   uv run uvicorn app.main:app --port 8000
   # в другом терминале:
   curl -s http://localhost:8000/contagion/network | jq '.nodes | length, .edges | length'
   ```

   Должно вернуть `9` и `16`.

3. **На Railway** после деплоя:

   ```
   curl -s -o /dev/null -w '%{http_code}\n' https://liquidpilot.up.railway.app/contagion/network
   ```

   Должно вернуть `200`.

4. **Frontend** `/contagion` грузит граф, форма «Шок контрагента» с дефолтом `USD-Correspondent / 1.0 / 7d` появляется слева, в центре SVG с 9 нодами. Клик «Run» возвращает $47.85M / 2 breached / 9 affected.

5. **Lint/build:**

   ```
   cd frontend && npm run lint && npm run build
   ```

   Зелёные. Frontend не трогаем, но проверь что ничего не сломалось.

## Не трогать

- `backend/app/services/liquidity/{forecaster,risk_manager,config,data_generator,feature_engineering,mock_data}.py` — Azim's engine. `contagion.py` и `stress.py` в этой папке — fair game (Phase 5/6, добавлены командой).
- `frontend/` — все ошибки на бэкенде. Никаких изменений во frontend не нужно.
- Railway / Vercel settings — НЕ менять. Не пытайся переключить build context Dockerfile на repo root или подвинуть Dockerfile — это поломает Railway конфиг.
- Никаких новых пакетов (`networkx`, `pandas` уже есть). Никаких `try/except Exception: pass`.
- Не добавлять комментарии-объясняющие-дифф («fix for Railway 500»). Комментарии — только в формате «что делает код в целом», как в новом блоке выше.

## PR title

`fix(backend): move contagion fixture into backend image so Railway can find it`

## PR description

- **Проблема:** `_FIXTURE_PATH` в `contagion.py` указывает на `<repo>/data/fixtures/contagion_exposures.json`. Railway-Docker строит из `backend/` как контекста, `data/` в образ не попадает, путь резолвится в `/data/fixtures/...` → `FileNotFoundError` → 500 на `/contagion/network` и `/contagion/simulate`.
- **Фикс:** `git mv` фикстуры внутрь `backend/app/fixtures/`, `_FIXTURE_PATH` через `parents[2]` от `__file__`. 2 файла изменены, 1 файл перемещён, 0 новых зависимостей.
- **Before/after на проде:**

  ```
  # before
  $ curl -s -o /dev/null -w '%{http_code}\n' https://liquidpilot.up.railway.app/contagion/network
  500

  # after
  $ curl -s -o /dev/null -w '%{http_code}\n' https://liquidpilot.up.railway.app/contagion/network
  200
  ```

  + скрин `/contagion` со загруженным графом (9 нод, USD-Correspondent в центре, форма «Шок контрагента» слева).

---

## Lesson for next Devin

Прод-Docker и локальный dev — разные tree-shapes. `Path(__file__).resolve().parents[N]` с большим `N` (>= 3) — антипаттерн: каждый лишний `.parents[]` это допущение про layout, которое в контейнере ломается. Якорить нужно на максимально близком общем корне (`parents[2]` = `app/`, не `parents[4]` = repo root) и хранить фикстуры внутри того tree, который Dockerfile COPY-ит.
