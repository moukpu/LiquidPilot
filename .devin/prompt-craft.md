# Prompt craft — how to write prompts the coding agent will execute well

The user pastes your prompts into Kimi K2, Opus 4.7, or Gemini. Those
agents work fast but they need precision. Below is what works on this
project.

## Anatomy of a good prompt

```
Контекст: репо https://github.com/moukpu/LiquidPilot, ветка main, HEAD <SHA>.
<One-paragraph problem statement in plain Russian / English mix.>

================= БАГ N: <short name> =================

Файл: <relative/path/to/file>
Строки: ~<from>–<to>

Сейчас (что в коде):
  <quoted snippet>

Проблема:
  <root cause in 1-3 sentences>

Что сделать:
1) <step>
2) <step>
3) <step>

Acceptance:
- <observable check 1>
- <observable check 2>

================= Дополнительно =================
- Не трогать <list of files / modules>.
- npm run lint / npm run build / pytest должны быть зелёные.
- PR title: <conventional commit>
```

## Rules

1. **Always include HEAD SHA.** The agent might pull a stale repo
   otherwise. Verify the SHA with `git log -1` before sending the
   prompt to the user.
2. **Quote the actual code** (≤ 20 lines) so the agent can locate
   instantly. Don't paraphrase the bug.
3. **Path is `frontend/...` or `backend/...`** — never just a filename.
4. **One PR per prompt.** If you have 3 unrelated bugs, generate 3 prompts.
   Exception: 5 UX bugs on the same page → bundle, but list them as
   numbered sections.
5. **Acceptance criteria are observable.** Not "make it pretty" but
   "Δ-цвет: только rose или neutral grey, никогда не emerald".
6. **Always restate the Azim taboo** in the "Не трогать" section if
   the prompt is anywhere near `backend/app/services/liquidity/`.
7. **Tell the agent to update i18n** if any user-facing string changes.
   Both `en.ts` and `ru.ts`.
8. **Add a test** when the bug is a regression risk (e.g. monotonicity
   in Time Machine, alerts/transfers sync in Autopilot). Backend uses
   `pytest`. Frontend has no test suite — say "add manual screenshot
   acceptance in PR body" instead.
9. **PR title format:** Conventional Commits.
   `fix(scope): …`, `feat(scope): …`, `chore(scope): …`, `refactor(scope): …`.
   Scopes used so far: `autopilot`, `radar`, `timemachine`, `lint`,
   `backend`, `frontend`, `i18n`.
10. **Ask for before/after screens** in the PR description when the bug
    is visual.

## Anti-patterns the agent will do if you let it

- Adds `try/except Exception: pass` around code it doesn't understand.
  Forbid this explicitly in any backend prompt.
- Bumps `next` / `react` to "fix" peer-deps. Forbid in lint-related prompts.
- Introduces a new library to solve a small problem (e.g. pulls
  recharts for a sparkline). Forbid — say "no new deps unless I asked".
- Modifies more files than needed. Say "минимальный diff" / "no drive-by refactors".
- Touches Azim's engine files. Restate the list every time.
- Writes comments explaining the diff ("// fix for bug"). Forbid — they're
  noise. Comments should describe what the code does in general.
- Skips tests. If you said "add test", repeat it in acceptance.
- Force-pushes or amends commits. Forbid — only new commits allowed.

## Tone in prompts

Russian intro paragraph + bilingual code/path/identifier names works
well. The user reads them too — keep them skimmable.

Don't write long preambles ("В рамках задачи по…"). Start with `Контекст:`.

## After the agent reports done

The user will paste the commit SHA + summary. Update:
- `.devin/state.md` HEAD line + relevant Phase row
- `.devin/prompts/INDEX.md` mark prompt as shipped

If acceptance criteria weren't met, generate a follow-up prompt
referencing the broken AC. Don't redo the whole prompt.
