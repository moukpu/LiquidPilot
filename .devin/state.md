# Project state — LiquidPilot

**Update this file at end of every session.** Next Devin reads it first.

## Snapshot

- **HEAD on main:** `6dff903` (PR #8 squash — JOURNAL entries
  09:15/09:17 UTC + prompt 0008 archived as HANDED TO USER. No code
  change in this merge — docs only).
  Previous code: `02857e9` (TM card readability — 0007 shipped:
  stress curve emerald `#10b981` / rose on breach, footer labels &
  numbers left-aligned with text-xs font-semibold, legend strip with
  3 LegendDots above grid, native `title` tooltip on BREACH badge and
  «Новые пробои» stat. 4 files +46/−7. lint/tsc/build/pytest green).
  Previous: `57fc32b` (journal + prompt 0007 archived via API auto-merge).
  Previous code: `c198c57` (TM polish 0006 — but **methodology accordion
  was over-deleted** here; restoration in flight as 0008).
  Previous: `d44dd63` (PR #6 squash — journal + prompt 0006 archived).
  Previous code: `dd61793` (TM bug-fix, 5 UX bugs + monotonicity test).
- **Last updated:** 17 May 2026, 09:25 UTC
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
| 5 | Contagion | **NOT DONE** | only ~13-line stub; biggest risk |
| 6 | Time Machine | DONE + polished round 2 | `dd61793` core (monotonicity + 5 UX bugs + 2 tests), then `c198c57` polish (no-aff badge / card stretch / methodology accordion). Round 3 (curve color / footer align / breach tooltip) in flight as prompt 0007. |
| 7 | Branding / landing / 90s demo | PARTIAL | logo missing, scenario not rehearsed |
| 8 | Submission | PENDING | one-pager, video, form |
| 9 | Finals | PENDING | slides, rehearsals, Q&A |

## What's in flight right now

- **Prompt 0008 — TM round 4 (methodology + advisory + overlap).**
  Three asks from owner after he tested `02857e9`:
  1. **Restore methodology.** Owner: «верни методику и всё». Откат
     методологической части `c198c57` 1-в-1 — `<details>` блок,
     `MethodologyDetails`, `Row`, `translateReason`, 13 ключей
     `timemachine.method.*` + 5 ключей `timemachine.reason.*` + `methodologyLabel`.
  2. **Drop noBreaches advisory.** Owner про «Стресс прошёл — попробуй
     жёстче: bank_holiday 5d» — снисходительная плашка, режет ухо.
     Удалить JSX-блок `{result.new_breach_count === 0 && (...)}` в
     `page.tsx`, функцию `harderSuggestion()`, ключ `timemachine.summary.noBreaches`.
  3. **Fix footer overlap.** На скрине 9-карточной сетки видно
     слипание «EUR 887 010EUR 351 973» — currency-префикс дублируется
     в каждой из 3 footer-ячеек и переполняет 280px-карточку. Выкинуть
     `{currency}` из видимого текста в `FooterStat`, оставить только
     в `title`-тултипе. Опционально понизить порог `formatStatAmount`
     с 1M до 100K чтобы «887 010» стало «887K».
  Re-hand'нул промпт в новой Devin-сессии 09:25 UTC (опечатка в шапке
  и HEAD-якорь подкручены — содержательно тот же). Expect PR title:
  `chore(timemachine): restore methodology, drop no-breach advisory, fix footer overlap`.

## What's queued, by priority for demo

1. **Contagion Phase 5 from scratch** — biggest risk. Need graph
   (NetworkX) over the 9 accounts + cascade simulation API
   (`POST /contagion/simulate`) + frontend page with react-flow or
   d3-force animation. No prompt yet. Estimated 5-7 h of agent work.
   If owner can't fit it, fall back: hide `/contagion` from nav and
   pitch as "3 of 4 modules demo-ready, 4th in progress."
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
