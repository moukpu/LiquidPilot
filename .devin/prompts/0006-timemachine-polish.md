# Time Machine — UX polish round 2

**Repo:** https://github.com/moukpu/LiquidPilot
**Base branch:** `main` (HEAD `28c3092`)
**Target PR title:** `chore(timemachine): hide not-affected, fix card stretch, drop methodology accordion`

Три точечных правки в Time Machine. Все три — фронт. Бэкенд не трогать.
Старый промпт `0005` уже смержен в `dd61793` — это полировка поверх него.

---

## Bug A — убрать строку «Не затронуто счетов: N: …»

**Файл:** `frontend/src/app/(dashboard)/timemachine/page.tsx`

Сейчас (строки 122-134):

```tsx
{notApplied.length > 0 && (
  <div className="mb-3 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs flex items-center gap-2 flex-wrap">
    <span className="text-muted-foreground">
      {t("timemachine.notAffected", {
        count: notApplied.length,
      })}
      :
    </span>
    <span className="font-mono text-foreground/80">
      {notApplied.map((a) => a.account_id).join(", ")}
    </span>
  </div>
)}
```

**Действие:** удалить весь этот блок целиком. Не оставлять «свёрнутое»
состояние, не оставлять иконку, ничего. Owner — фаундер — решил, что
для одно-страны сценария это шум.

Также убрать переменную `notApplied` если она больше не используется,
и переменную `applied` оставить как есть (она нужна для grid). Если
ESLint начнёт ругаться на `notApplied` — выкинуть её из destructuring.

i18n: удалить ключ `timemachine.notAffected` из `frontend/src/i18n/messages/en.ts`
и `frontend/src/i18n/messages/ru.ts` (грепни — должен быть в одном месте,
обычно строка `"Не затронуто счетов: {count}"` / `"Accounts not affected: {count}"`).

---

## Bug B — карточки растягиваются когда applied = 1

**Файл:** `frontend/src/app/(dashboard)/timemachine/page.tsx`, строки 135-141.

Сейчас:

```tsx
<div
  className="grid gap-3"
  style={{
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
  }}
>
```

`auto-fit` коллапсит пустые треки → когда applied всего 1 карточка
(например `bank_holiday SG`), одна карточка занимает всю ширину
страницы — выглядит абсурдно.

**Фикс:** заменить `auto-fit` на `auto-fill`. Это сохраняет «пустые»
треки шириной `minmax(280px, 1fr)`, и единственная карточка
останется в своём ~280-300px слоте, как когда их 5-9.

Итог:

```tsx
<div
  className="grid gap-3"
  style={{
    gridTemplateColumns:
      "repeat(auto-fill, minmax(280px, 1fr))",
  }}
>
```

Одна строка, одно слово. Не трогать `minmax`, не добавлять `max-w`,
не уводить в flex.

---

## Bug C — убрать аккордеон «Методика» целиком

Owner-фидбек: «убери всякие ненужные или объясняющие комментарии,
что значит множитель оттока? стоит ли это писать прям так?». Лейблы
типа «Множитель», «Доп. OUT/день», «Чистый отток/день», «Отложенный
отток» — академический жаргон, в питче будет резать ухо. Лучше убрать
блок целиком — карточка станет: заголовок + sparkline + 3 цифры. Всё.

**Файл:** `frontend/src/components/timemachine/result-card.tsx`

1) Удалить весь `<details>`-блок (строки 182-196):

```tsx
<details className="mt-2 group">
  <summary ...>
    ...
    {t("timemachine.methodologyLabel")}
  </summary>
  <div ...>
    <MethodologyDetails ... />
  </div>
</details>
```

2) Удалить функцию `MethodologyDetails` (строки 239-328).
3) Удалить функцию `Row` (строки 330-351) — она использовалась только
   из `MethodologyDetails`.
4) Удалить `translateReason` (строки 17-28) — она тоже была только
   для not-applied-методики.
5) Удалить хелпер `formatStatAmount` если он становится unused
   после удаления — но он используется в `FooterStat`, так что
   **скорее всего остаётся**. Перепроверь грепом.
6) Удалить из i18n (`en.ts` + `ru.ts`) **все** ключи под префиксом
   `timemachine.method.*` И `timemachine.methodologyLabel`. Это:
   - `timemachine.methodologyLabel`
   - `timemachine.method.notApplied`
   - `timemachine.method.sample`
   - `timemachine.method.days`
   - `timemachine.method.avgInflow`
   - `timemachine.method.avgOutflow`
   - `timemachine.method.daysAffected`
   - `timemachine.method.shiftPerDay`
   - `timemachine.method.multiplier`
   - `timemachine.method.extraPerDay`
   - `timemachine.method.country`
   - `timemachine.method.dailyNetOutflow`
   - `timemachine.method.deferred`
   - `timemachine.reason.noInboundOnRail`
   - `timemachine.reason.noOutboundOnRail`
   - `timemachine.reason.countryMismatch`
   - `timemachine.reason.zeroMultiplier`
   - `timemachine.reason.unknown`

7) В `result-card.tsx` оставшиеся импорты: убрать `MessageKey` если
   больше не нужен (был только для `translateReason`).

Бэкенд `methodology_inputs` в API-ответе оставляем как есть — фронт
просто его игнорирует. Никаких pydantic-моделей не трогать.

---

## Acceptance

1) На `/timemachine` после запуска bank_holiday SG `3d`:
   - НЕТ серой плашки «Не затронуто счетов: …».
   - Видна **одна** карточка `SGD-Singapore` шириной примерно как
     до фикса (≤ 320px), не растянутая на всю страницу.
   - У карточки: заголовок, sparkline, 3 нижние цифры (baseline /
     stress / delta). Кнопки/строки «▸ Методика» — нет.

2) Запусти `rail_delay 3d` SWIFT — applied-карточек снова много (9
   или 8), сетка по-старому. Никаких регрессий по компоновке.

3) Запусти `volume_spike ×1.30` — applied-карточки всех 9 счетов,
   delta-цвет: rose когда `delta<0`, нейтрал когда `delta>=0`. Никаких
   методик в карточке.

4) Запусти `bank_holiday KZ 1d` и `bank_holiday KZ 5d` — монотонность
   из `dd61793` сохранена (5d должно быть ≥ 1d по abs(sum delta)).
   Это просто визуальная проверка, тест `test_bank_holiday_monotonic`
   уже в репе.

5) `npm run lint` exit 0.
6) `npx tsc --noEmit` 0 errors.
7) `npm run build` зелёный.
8) `pytest backend/tests/` — 5 passed (как сейчас, мы бэкенд не
   трогаем).

---

## Что НЕ делать

- НЕ трогать `backend/app/services/liquidity/stress.py`.
- НЕ менять модель данных `AccountStressResult` / `methodology_inputs`.
- НЕ переписывать `ScenarioHint` (под-карточка перед Run) — он
  норм, owner критиковал только аккордеон «Методика» внутри
  карточки.
- НЕ менять цвета delta / total / stress — поведение зафиксировано
  в `dd61793`.
- НЕ добавлять никаких новых tooltip'ов / explanatory'ев — owner
  явно сказал «убери всё объясняющее».
- НЕ бампать `next`, `react`, `react-dom`, `eslint`.

---

## PR

PR title: `chore(timemachine): hide not-affected, fix card stretch, drop methodology accordion`

В описании привести скрины до/после для:
- bank_holiday SG 3d (одна карточка, не растянута, нет «не затронуто»)
- rail_delay 3d (9 карточек, как раньше)

После мержа я обновлю `.devin/prompts/INDEX.md` с SHA.
