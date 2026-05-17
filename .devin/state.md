# Project state — LiquidPilot

**Update this file at end of every session.** Next Devin reads it first.

## Snapshot

- **HEAD on main:** `059f0da` (TM round 4 — 0008 shipped: methodology
  accordion `<details>` restored 1-to-1 from `c198c57^` including
  `MethodologyDetails` + `Row` + `translateReason` + 13 ключей
  `timemachine.method.*` / 5 ключей `timemachine.reason.*` /
  `methodologyLabel` в en + ru; зелёная noBreaches-плашка и функция
  `harderSuggestion` удалены из `page.tsx`; ключ
  `timemachine.summary.noBreaches` снят; в `FooterStat` `{currency}`
  убран из видимого текста — остался только в `title`-тултипе; порог
  `formatStatAmount` понижен 1M → 100K → значения ≥ 100k идут как
  `887K`/`352K`. 4 файла +188/−34. tsc 0 errors, lint clean, build
  green, pytest 5 passed).
  Previous: `b38635b` (PR #9 squash — docs-only re-hand 0008 +
  journal 09:25).
  Previous: `6dff903` (PR #8 squash — docs-only).
  Previous code: `02857e9` (TM card readability — 0007 shipped).
  Previous: `57fc32b` (journal + prompt 0007 archived).
  Previous code: `c198c57` (TM polish 0006 — methodology over-deleted,
  later restored in 0008).
- **Last updated:** 17 May 2026, 09:50 UTC
- **Memory live in repo:** YES — `.devin/` merged via PR #5 into `main`.
  Owner authorised direct push for docs only; system **hard-blocks**
  `git push origin main` (tested — error: «You should never push directly
  to master or main.») so the analysis-Devin uses a tight loop:
  branch → push → POST /pulls → PUT /pulls/{n}/merge?merge_method=squash
  → branch dies in ~10s. From owner's POV — single squash commit on
  main, no PR backlog.
- **Submit deadline:** 20 May 2026 23:59 (≈ 87 h left)
- **Finals (Astana):** 24 May 2026 (≈ 7 days)

## Tech stack — locked

- Next.js `14.2.0`, React `18.3.1`, React-DOM `18.3.1` — do not bump.
- ESLint `8.57.1`, eslint-config-next `14.2.0` — pinned exact (Phase 2.5).
- FastAPI + Pydantic v2, SQLAlchemy 2.0, SQLite, NetworkX, xgboost.
- three.js + react-three-fiber for 3D globe.
- Vercel (frontend) + Railway (backend).

## Production URLs

- Frontend: `https://liquid-pilot.vercel.app`
- Backend: `https://liquidpilot.up.railway.app`
- Health: `https://liquidpilot.up.railway.app/health` → expect 200
- Warmup endpoint: `POST /admin/warmup` (Plan B when lazy warm_up lags)

## Phase status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Scaffold | DONE | `fa4b7de`, `009cf4f` |
| 2 | Backend + Azim engine | DONE | `7e68ec9` … `a1000ad` |
| 2.5 | Deploy fixes | DONE | `2302a99`, `10508c3`, `e3171c0`, `20e0982` |
| 3 | Radar (ATC view) | DONE + polished | latest `cef9347` removed violet planes |
| 4 | Autopilot | DONE + polished | latest `a09cb0d` synced alerts ↔ transfers |
| 5 | Contagion | **IN FLIGHT — backend** | Stubs were 13 lines each (front + back). Backend prompt 0009 handed to user 09:50 UTC: NetworkX graph from `data/fixtures/contagion_exposures.json` + BFS cascade simulator + `GET /contagion/network` + `POST /contagion/simulate` + 6 pytest. Frontend = separate prompt 0010 after 0009 ships. |
| 6 | Time Machine | DONE round 4 (`059f0da`) | `dd61793` core (monotonicity + 5 UX bugs + 2 tests) → `c198c57` polish (no-aff badge / card stretch — methodology over-deleted here) → `02857e9` readable card (stress curve color / footer align / breach tooltip) → `059f0da` round 4 (methodology restored + advisory dropped + footer-overlap fix). No more TM rounds planned unless owner finds something. |
| 7 | Branding / landing / 90s demo | PARTIAL | logo missing, scenario not rehearsed |
| 8 | Submission | PENDING | one-pager, video, form |
| 9 | Finals | PENDING | slides, rehearsals, Q&A |

## What's in flight right now

- **Prompt 0009 — Contagion Phase 5, backend only.** Phase 5 был
  единственной фазой целиком на заглушках (front + back). 09:50 UTC
  отдан промпт на **backend-half** Phase 5, специально нарезанный
  отдельно от фронта чтобы не словить over-delete на 7-часовом PR:
  - `data/fixtures/contagion_exposures.json` — 16 направленных
    bilateral exposures между 9 счетами в USD-numeraire. USD-Correspondent
    специально центральный hub (5 исходящих) — самый зрелищный шок
    на демо. Никаких counterparty-данных в `state.transactions`
    нет, поэтому идём через статическую фикстуру, не через
    реконструкцию из ленты.
  - `backend/app/services/liquidity/contagion.py` (NEW) — `load_exposures`,
    `build_graph(nx.DiGraph)`, `simulate_cascade(shocked, intensity,
    horizon_days)` с BFS-каскадом и геометрическим decay 0.6 на хоп
    (cap MAX_HOPS=4). FX через существующий `FX_RATES_TO_USD` из
    `config.py`. **Не Азимовская территория** — новый модуль на
    уровне `stress.py`.
  - `backend/app/api/routes/contagion.py` (REPLACE 9-line stub):
    `GET /contagion/network` (не требует warm-up, fallback на
    opening_balance) + `POST /contagion/simulate` (требует
    warm-up, читает `state.daily_balances`).
  - `backend/tests/test_contagion.py` — 6 тестов: fleet match,
    hub-shock direct neighbours, intensity monotonic, 9-node
    snapshot, invalid account ValueError, invalid intensity
    ValueError.
  Expect PR title: `feat(contagion): bilateral exposure graph + cascade simulator (Phase 5 backend)`.

## What's queued, by priority for demo

1. **0010 — Contagion Phase 5, frontend.** Только после shipping 0009.
   d3-force (или нативный SVG) граф на `/contagion`, форма выбора
   шокированного банка, ползунок intensity, side-panel пострадавших.
   Зависит от `GET /contagion/network` и `POST /contagion/simulate`
   из 0009. Без бэка фронт лепить нет смысла.
2. Phase 7 — logo (text wordmark only today), 90-second connected demo
   script, landing polish.
3. Phase 8 — one-pager PDF, 3-minute demo video, SynergyX submission form.
4. Phase 9 — slides 10–12, ≥5 live demo rehearsals, Q&A bank.

## Known fragile spots

- `flat_value = baseline[0]` in `stress.py` BANK_HOLIDAY branch — this
  is what TM prompt #0004 rewrites. Don't reintroduce.
- `synthAlerts` vs `synthTransfers` in `frontend/src/lib/autopilot-synth.ts`
  used to be desynced (alerts on JPY/SGD, transfers from KZT to USD/EUR).
  Fixed in `a09cb0d`. If you see a regression — check FX normalisation.
- Violet "execute-event" planes — removed in `cef9347`. Do not bring
  them back. Confirmations live in `/autopilot` only.
- `next lint` peer-deps — pinned in `20e0982`. Don't bump.
- TS 5.5.4 vs `@typescript-eslint` "officially supported up to 5.5.0"
  warning is **harmless**. Don't fix it in this PR cycle.

## Accounts on disk (synthetic data)

9 accounts × 7 currencies, 540 days of history, 23 430 transactions.
See `.devin/glossary.md` for full mapping.

## Backend engine — do not touch

`backend/app/services/liquidity/` is Azim's territory **except**
`stress.py` (Phase 6, added by the team). Read-only:

- `forecaster.py`
- `mock_data.py`
- `risk.py`
- `config.py`
- `data_generator.py`
- `feature_engineering.py`

Fair game:
- `stress.py` (Time Machine engine)
- Anything in `backend/app/api/routes/` or `backend/app/services/engine_state.py`
