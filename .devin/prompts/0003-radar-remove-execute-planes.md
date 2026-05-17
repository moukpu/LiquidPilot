# 0003 — Radar: remove violet execute-event planes entirely

**Status:** SHIPPED in `cef9347`
**Date:** 17 May 2026

## Problem

Confirmations of executed transfers were duplicated: green check + badge
in `/autopilot`, and a violet plane on `/radar`. The violet planes were
also visually broken (see 0002). Remove the second channel.

## Prompt

```
Контекст: репо https://github.com/moukpu/LiquidPilot, ветка main.
Полностью удалить фиолетовые "execute-event" самолёты с /radar — и в 3D
глобусе, и на плоской карте. Подтверждения исполнения переводов уже
показываются в /autopilot (галочка + бэйдж "Settled on RAIL"), второй
канал визуализации не нужен и мешает (см. issue с гипертрофированной
моделью).

Файлы и что сделать:

1) frontend/src/components/radar/globe-3d.tsx
   - Удалить useExecuteEvents импорт и вызов внутри World().
   - Удалить целиком блок `const executeFlights = useMemo(...)` (строки
     примерно 390–414).
   - Удалить JSX-блок `{executeFlights.map(...)}` (примерно 464–475).

2) frontend/src/components/radar/world-map.tsx
   - Удалить useExecuteEvents импорт и вызов внутри WorldMap().
   - Удалить блок `const executeFlights = useMemo(...)` (около 233–267).
   - Удалить JSX-блок `{executeFlights.map(...)}` (около 429–...).

3) frontend/src/app/(dashboard)/radar/page.tsx
   - Удалить импорт `useExecuteEvents` и переменную `executeEvents`.
   - Убрать JSX-блок в Floating Status Bar, который показывает
     "executeInFlight" pill (бордовая фиолетовая пилюля справа от ONLINE).

4) frontend/src/lib/execute-events.ts
   - Удалить файл целиком (или оставить пустой стаб с экспортом
     no-op pushExecuteEvent, если что-то ещё его импортирует — но проще
     удалить и пройтись `rg execute-events` чтобы найти все usages).

5) frontend/src/components/autopilot/action-card.tsx
   - Удалить импорт pushExecuteEvent и блок useEffect, который его
     вызывает после state === "executed" (около 111–123). Сам флоу
     "executed → галочка → плашка Settled" сохранить как есть.

6) frontend/src/i18n/messages/en.ts и ru.ts
   - Удалить ключ "radar.executeInFlight" если он есть.

7) Проверить `rg useExecuteEvents` и `rg pushExecuteEvent` и `rg execute-events`
   — после правок не должно остаться ни одного match'а.

Acceptance:
- На /radar нет ни одного фиолетового объекта.
- Кнопка Execute в /autopilot всё ещё работает: карточка проходит
  queued → confirming → executing → executed с progress bar и финальным
  "Settled on RAIL" бэйджем (этот пайплайн руками не трогать).
- npm run lint и npm run typecheck зелёные.

PR title: chore(radar): remove violet execute-event planes
```
