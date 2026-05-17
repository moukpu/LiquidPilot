# 0002 — Radar: downsize violet execute-event planes (SUPERSEDED)

**Status:** SUPERSEDED by 0003 (user decided to remove rather than resize)
**Date:** 17 May 2026
**Outcome:** user said "надо вообще убрать подобный самолетик"

## Problem

Violet "execute-event" planes on `/radar` were `size: 0.04`, 4–10x bigger
than normal planes (`0.004 / 0.006 / 0.009`). At that scale the low-poly
model degenerated into a cross / blob.

First attempt was to downsize to `0.009` + add pulse animation. User
rejected this and asked to remove the entire feature.

## Lesson for next Devin

When the user shows a screenshot and says "что за самолетик странный" —
that's "what's this weird plane", **not** a UX preference question. The
real complaint is that the visualisation channel itself is noise:
execution confirmations are already shown in `/autopilot` as a green
badge. Two channels = duplicate UX = bug.

Default to **remove** before **resize** when the user is annoyed.
