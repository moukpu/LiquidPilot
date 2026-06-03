# AGENTS.md

**Stop. Read this before doing anything.** This file gives any AI agent (Devin, Claude, Cursor, Copilot) the context they need to work on this repo without losing time relearning the same things.

## Step 0 — read `.devin/CONTEXT.md` first

Full project state, hard rules, architecture, what's done, what's pending, user preferences, session log. **Read it.** This file is just the TL;DR.

## Hard rules (do not break)

1. **Push to `main` directly.** No feature branches, no PRs. One commit per task. (User's explicit instruction.)
2. **Do NOT touch** `backend/app/services/liquidity/*` — Azim's engine, works, fragile.
3. **Do NOT add npm packages** without asking the user.
4. **i18n lockstep:** every `frontend/src/i18n/messages/en.ts` change has a matching `ru.ts` change. TypeScript enforces `MessageKey`.
5. **Never run** `git config <anything>`, `git reset --hard`, `git push --force`, `--no-verify`, `git add .`.
6. **Never commit secrets.** If the user pastes a token in chat, refuse to save it and ask them to revoke it.
7. **Vercel CI cares about errors, not warnings.** Don't waste hours chasing `--max-warnings=0`.

## Repo at a glance

- **Backend:** FastAPI + uv, 9 accounts, XGBoost P05/P50/P95 forecast, NetworkX (for upcoming contagion). Started in background via lifespan, ~30s warm-up.
- **Frontend:** Next.js 14 App Router + Tailwind + i18n EN/RU. 5 pages: `/` (landing), `/radar` (3D globe), `/autopilot`, `/contagion` (stub), `/timemachine`.
- **Deadline:** 2026-05-20 23:59 UTC submission, 2026-05-24 finals in Astana.

## Workflow

1. Read `.devin/CONTEXT.md`.
2. If user requests a fix/feature → check `## What's pending` section. The next prompt is usually already drafted under `.devin/prompts/`.
3. Make changes. Run `cd frontend && npx tsc --noEmit && npm run build` before committing.
4. Commit & push to `main` directly. Conventional message (`fix(ui):`, `feat(autopilot):`, etc.).
5. **Update `.devin/CONTEXT.md` Session log section.** Add a brief entry under `## Session log` with: date, what user asked, what you did, commit hash, files touched, any blockers for next session. Commit + push this in the same commit or a follow-up.

## Forbidden in UI

- Raw account IDs (`EUR-Main`, `EUR-Frankfurt`) → use `displayAccountLabel(id)` from `lib/format.ts`.
- Truncated money values for amounts < 1,000,000 → use full number with thousand separators.
- Mixed-language strings (e.g. Russian UI + English backend reason) → translate via i18n keys.
- Random/synthetic counts where real data exists.

## User preferences quick-ref

- Russian-speaking, prefers concise terse Russian responses (no emoji, no "I'll help you with…").
- Wants compact notation only for millions+ (`1.2M`), not for thousands.
- Wants real data everywhere (real in-flight count, real FX conversion preview).
- Hates clutter ("Подробные метрики радара", "Бухгалтерский баланс", "SYSTEM ONLINE" — all removed).
- Wants to see plane animation on radar when Execute is clicked in Autopilot (P3 in round 3 prompt).

## Where to look

| Need | File |
|---|---|
| Add i18n key | `frontend/src/i18n/messages/{en,ru}.ts` (both!) |
| New route (backend) | `backend/app/api/routes/{name}.py` + register in `backend/app/main.py` |
| New page (frontend) | `frontend/src/app/(dashboard)/{name}/page.tsx` |
| FX rate | `frontend/src/components/radar/globe-3d.tsx` (will move to `lib/fx.ts`) |
| Money format | `frontend/src/lib/format.ts` |
| Account label | `displayAccountLabel()` in `lib/format.ts` |
| Demo mode logic | `frontend/src/components/use-autopilot-state.ts` |

## Open prompts (ready to execute)

- `.devin/prompts/round3_fixes.md` — 17 fixes after round 2 testing. **Next up.**
- `.devin/prompts/phase5_contagion.md` — Phase 5 contagion graph (the biggest gap, most "wow" feature).

After round 3 → Phase 5 → Phase 7 (demo script + landing polish + README cleanup) → Phase 8 (one-pager PDF + 3-min video).
