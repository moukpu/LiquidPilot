# 0004 — ESLint: pin eslint 8.57 + eslint-config-next 14.2

**Status:** SHIPPED in `20e0982`
**Date:** 17 May 2026

## Problem

`next lint` failed because neither `eslint` nor `eslint-config-next` were
in `frontend/package.json` devDependencies, and there was no
`.eslintrc.json`. The transient install pulled the latest major of
`eslint-config-next` (16.x), which demands `eslint@>=9`, but `next@14.2.0`
only works with eslint 8. Result: peer-deps warning storm on every
`npm install`, and CI choked.

## Fix

Pin `eslint@8.57.1` (exact) and `eslint-config-next@14.2.0` (exact). Add
minimal `.eslintrc.json` that extends `next/core-web-vitals`. Do not bump
`next` / `react` / `react-dom`.

## Prompt

```
Контекст: репо https://github.com/moukpu/LiquidPilot, ветка main.
В frontend/ команда `next lint` ломается на peer-deps: eslint-config-next пытается
подтянуть последнюю мажорку (16.x), которая требует eslint@>=9, при этом в репо
зафиксирована Next.js 14.2.0. Юзер хочет, чтобы `npm install` и `npm run lint`
проходили чисто без --legacy-peer-deps.

Текущее состояние:
- frontend/package.json: НЕТ ни eslint, ни eslint-config-next в devDependencies.
- frontend/.eslintrc.json: отсутствует.
- next@14.2.0 в dependencies.

Задача:

1) Из директории frontend/ установить точные версии (без ^):
     npm install --save-dev --save-exact eslint@8.57.1 eslint-config-next@14.2.0
   Если npm ругается на peer-deps из-за остатков node_modules — снести node_modules
   и package-lock.json, поставить заново тем же npm install --save-dev …, потом
   обычный npm install.

2) Создать frontend/.eslintrc.json с минимальным конфигом:
   {
     "extends": ["next/core-web-vitals"]
   }

3) Запустить `npm run lint` — должен пройти без warnings про peer-deps. Любые
   реальные lint-ошибки в коде:
     - если их мало (<5) и они тривиальные — поправить.
     - если их много — ВЫНЕСТИ В ОТДЕЛЬНЫЙ commit/PR и в текущем PR просто
       подавить через короткий "rules": { ... "off" } блок в .eslintrc.json,
       чётко закомментировав «временно отключено, см. issue X».

4) НЕ менять версию next, react, react-dom. НЕ ставить eslint 9.

Acceptance:
- `npm install` в свежем чекауте проходит без warning'ов о peer-deps.
- `npm run lint` возвращает exit code 0.
- `npm run build` всё ещё работает.
- Все версии: eslint=8.57.1, eslint-config-next=14.2.0 (exact, без ^).

PR title: chore(lint): pin eslint 8.57 + eslint-config-next 14.2 to match next 14
```

## Known caveat

`@typescript-eslint` prints a warning that TS 5.5.4 is "officially
supported up to 5.5.0". Harmless. Leave it.
