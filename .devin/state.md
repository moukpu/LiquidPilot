# Project state — LiquidPilot

**Update this file at end of every session.** Next Devin reads it first.

## Snapshot

- **HEAD on main:** `28c3092` (merge of PR #5 — `.devin/` memory system).
  Previous code HEAD: `dd61793` (Time Machine bug-fix, all 5 bugs + tests).
- **Last updated:** 17 May 2026, 08:46 UTC
- **Memory live in repo:** YES — `.devin/` merged via PR #5 into `main`.
  Owner authorised direct push for docs only; system blocks direct push
  to `main`, so docs updates ship via short-lived branches + PR.
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
| 6 | Time Machine | DONE + SHIPPED | `dd61793` — bank_holiday monotonicity + 5 UX bugs + 2 new tests |
| 7 | Branding / landing / 90s demo | PARTIAL | logo missing, scenario not rehearsed |
| 8 | Submission | PENDING | one-pager, video, form |
| 9 | Finals | PENDING | slides, rehearsals, Q&A |

## What's in flight right now

- Nothing. Time Machine fix landed in `dd61793`. Memory system landed
  in `28c3092` (PR #5 merged). Awaiting owner's next priority.

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
