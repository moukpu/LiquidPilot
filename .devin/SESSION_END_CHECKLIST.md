# Session-end checklist

Run through this before going offline. Don't skip — the next Devin will
hate you if you do.

**NB:** per-prompt journaling (see `.devin/START.md` → "Per-prompt
ritual") is a separate, MORE FREQUENT loop. Don't confuse the two.
The journal is written on every user message; the items below are
end-of-session housekeeping.

## 1. Update `.devin/state.md`

- [ ] HEAD SHA line at top — copy from `git log -1 --format=%H`
- [ ] "Last updated" date/time
- [ ] Mark any phase row whose status changed
- [ ] Update "What's in flight" — what is the next coding agent working on?
- [ ] Update "What's queued, by priority" — re-rank if the deadline is closer
- [ ] Add any new entry to "Known fragile spots" if you learned about one

## 2. Update `.devin/prompts/INDEX.md`

- [ ] Add a row for every prompt you generated this session
- [ ] Mark any prompt that landed (status SHIPPED + SHA)
- [ ] Mark any prompt the user discarded (status SUPERSEDED)

## 3. Archive new prompts to `.devin/prompts/NNNN-slug.md`

- [ ] Numbering continues from the last existing prompt — DO NOT reuse numbers
- [ ] Copy the exact text you sent to the user, fenced
- [ ] Add a one-paragraph problem statement
- [ ] If you learned a lesson, add a "Lesson for next Devin" footer

## 4. Patch `.devin/style.md` / `.devin/constraints.md` if needed

If the user said something like:
- "не делай X больше"   → constraints.md
- "пиши короче"          → style.md
- "не пиши emoji"        → style.md (already there, but reinforce)
- "не трогай файл Y"     → constraints.md
- new pet term or alias  → glossary.md

If the user reaffirmed something already in those files — don't touch
them. Only patch on **new** information.

## 5. Hand a commit-prompt to the user

Generate one short prompt for the coding agent that bundles all your
`.devin/` updates into a single commit. Pattern:

```
Контекст: репо LiquidPilot, ветка main, HEAD <SHA>.
Закоммить обновления .devin/ — это память для следующего Devin'а.

Файлы (создать или заменить целиком, я выкину их аттачами):
- .devin/state.md
- .devin/prompts/INDEX.md
- .devin/prompts/NNNN-<slug>.md          (новые промпты, если есть)
- (опционально) .devin/style.md / constraints.md / glossary.md

Что НЕ делать:
- Не редактируй текст файлов, просто положи как есть.
- Не трогай .devin/START.md / prompt-craft.md / SESSION_END_CHECKLIST.md
  если я их не прислал — они стабильные.
- Не открывай PR, push прямо в main (это документация, не код).

PR title: chore(devin-memory): sync session <date> handoff
```

## 6. Final message to user

One line: "Память синхронизирована, HEAD `<SHA>`. Промпт на коммит .devin/
ниже." + attach the commit-prompt as a file.

Then `block_on_user=true` and stop.
