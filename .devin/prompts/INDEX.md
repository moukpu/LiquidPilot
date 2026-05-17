# Prompts archive — INDEX

Every prompt the analysis-Devin handed to the user goes here. One file
per prompt. Status tracked in the table below. Numbered chronologically.

| ID   | Title                                              | Shipped in | Status     |
|------|----------------------------------------------------|------------|------------|
| 0001 | Autopilot: sync alerts with transfers + FX quotes  | `a09cb0d`  | SHIPPED    |
| 0002 | Radar: downsize violet execute planes              | —          | SUPERSEDED |
| 0003 | Radar: remove violet execute planes entirely       | `cef9347`  | SHIPPED    |
| 0004 | ESLint: pin 8.57 + eslint-config-next 14.2         | `20e0982`  | SHIPPED    |
| 0005 | Time Machine: bank_holiday monotonicity + UX bugs  | `dd61793`  | SHIPPED    |
| 0006 | Time Machine polish: hide not-affected, fix card stretch, drop methodology | `c198c57` | SHIPPED        |
| 0007 | Time Machine card readability: stress curve color, footer alignment, breach tooltip | `02857e9` | SHIPPED        |
| 0008 | Time Machine round 4: restore methodology, drop no-breach advisory, fix footer overlap | `059f0da` | SHIPPED        |
| 0009 | Contagion Phase 5 backend: bilateral exposure graph + cascade simulator | `205e535`  | SHIPPED        |
| 0010 | Contagion Phase 5 frontend: graph viz + shock form + result panel       | `87416b0`  | SHIPPED        |
| 0011 | Contagion: move fixture into backend image (fix Railway 500)            | —          | HANDED TO USER |

## How to add a new prompt

1. Bump the number: copy `NNNN-slug.md` skeleton (or write fresh).
2. Set `Status: GENERATED` while you're still drafting.
3. Set `Status: HANDED TO USER` once delivered via `message_user`.
4. Set `Status: IN FLIGHT` once user confirms agent is working on it.
5. Set `Status: SHIPPED in <SHA>` once user pastes the commit.
6. Set `Status: SUPERSEDED by NNNN` if user changes direction and you
   produce a replacement.
7. Update the table above.

## Conventions for the file body

Each archived prompt should have:
- Title, status, generation date.
- One-paragraph problem statement.
- The **exact text** you handed to the user, fenced as a code block,
  unedited. (So the next Devin can see what shape worked.)
- Optional "Lesson for next Devin" footer if there's something to learn.
