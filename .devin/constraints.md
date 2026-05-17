# Constraints — what you can and cannot do

Source of truth: `docs/HANDOFF.md` section 10 + everything the user has
reaffirmed in chat. If something below conflicts with a direct user
instruction *in this session*, the user wins.

## Hard NO

1. **No `git push` for CODE.** You may push `.devin/` and `README.md`
   docs updates directly to `main` (owner authorised 2026-05-17). You
   still must NOT push code changes (anything outside `.devin/` or
   `README.md` "For AI agents" block). Code goes through a coding agent.
2. **No PR creation for code.** Even via `git_create_pr` tool — don't.
3. **No edits to Railway / Vercel settings.** Read-only there too.
4. **No edits to `backend/app/services/liquidity/{forecaster,mock_data,risk,config,data_generator,feature_engineering}.py`.**
   That's Azim's engine code, working as-is. `stress.py` in the same
   folder is **NOT** Azim's — it was added in Phase 6 and is fair game.
5. **No OpenAI API key handling.** No LLM calls from backend. All "AI"
   in this project is heuristics + xgboost + synthetic data on the
   frontend.
6. **No major-version bumps** of `next`, `react`, `react-dom`. They are
   pinned to `14.2.0`, `18.3.1`, `18.3.1`. Anything else breaks.

## Hard YES

1. **Read everything.** Files, git log, git diff, build logs.
2. **Generate prompts** as `.md` files, attach via `message_user`.
3. **Update `.devin/` files** and push directly to `main` (owner
   authorised). This includes JOURNAL.md entries on every user message.
4. **Curl Railway and Vercel** to verify deploy health. Endpoints:
   - `https://liquidpilot.up.railway.app/health` should return 200
   - `https://liquid-pilot.vercel.app/` should render
5. **Use `git_view_pr`** if the user sends a PR link or number — but
   only to read, never to comment / merge.

## Soft rules

- The hackathon deadline is hard: **20 May 2026 23:59** for submission,
  **24 May** for finals in Astana. Optimise prompt quality over breadth
  as the deadline approaches.
- If a prompt blocks Contagion (Phase 5), prioritise it. Contagion is
  the only fully-missing module of the core "4-in-1 cockpit" pitch.
- If you spot security or fintech-style issues (PII, secrets in repo,
  injection vectors), flag immediately even if not asked.

## Auth / secrets

- The user does not give you any production credentials. Don't ask.
- Git is auto-authenticated for read and write (owner gave PAT 2026-05-17).
- Railway / Vercel are publicly reachable for read-only health checks.

## When in doubt

Ask. The user prefers one terse question over an unverified action.
But: don't ask about things already answered in `.devin/state.md` or
the git log — read first.
