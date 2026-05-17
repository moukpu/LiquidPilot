import type en from "./en";

const ru: Record<keyof typeof en, string> = {
  "app.title": "LiquidPilot — Прогнозный кокпит ликвидности",
  "app.description":
    "Управление воздушным движением для вашей казны. Радар, Автопилот, Сетевой риск и Машина времени.",

  "topbar.dashboard": "Панель",
  "nav.radar": "Радар",
  "nav.autopilot": "Автопилот",
  "nav.contagion": "Сетевой риск",
  "nav.timemachine": "Машина времени",

  "switcher.aria": "Язык",

  "status.lastSync": "Синхронизация",
  "status.online": "онлайн",
  "status.offline": "офлайн",

  "severity.CRITICAL": "КРИТИЧНО",
  "severity.WARNING": "ВНИМАНИЕ",
  "severity.INFO": "ИНФО",

  "radar.eyebrow": "Радар · Диспетчерская вышка",
  "radar.title": "Деньги в полёте, прямо сейчас",
  "radar.subtitle": "Поток платежей по вашим счетам в реальном времени.",
  "radar.flowSize": "Размер потока",
  "radar.legend.small": "< $100к",
  "radar.legend.medium": "< $1М",
  "radar.legend.large": "≥ $1М",
  "radar.legend.hoverHint": "Кликните на самолёт, чтобы увидеть детали",
  "radar.tooltip.direction": "Направление",
  "radar.tooltip.amount": "Сумма",
  "radar.tooltip.paymentType": "Тип платежа",
  "radar.tooltip.valueDate": "Дата валютирования",
  "radar.tooltip.delay": "Задержка клиринга",
  "radar.tooltip.from": "Откуда",
  "radar.tooltip.to": "Куда",
  "radar.tooltip.close": "Закрыть",
  "radar.frozen.title": "Замороженная ликвидность",
  "radar.frozen.ofTotal": "от общего баланса",
  "radar.frozen.allDeployed": "Свободного капитала нет — всё в работе.",
  "radar.reliability.title": "Надёжность рельсов",
  "radar.direction.IN": "ПРИХОД",
  "radar.direction.OUT": "РАСХОД",
  "radar.city.frankfurt": "Франкфурт",
  "radar.city.newYork": "Нью-Йорк",
  "radar.city.london": "Лондон",
  "radar.city.berlin": "Берлин",
  "radar.city.losAngeles": "Лос-Анджелес",
  "radar.city.zurich": "Цюрих",
  "radar.city.tokyo": "Токио",
  "radar.city.singapore": "Сингапур",
  "radar.city.almaty": "Алматы",

  "account.bufferBreach": "Буфер пробит",
  "account.vsFloor": "к минимуму",
  "account.in": "Приход за сегодня",
  "account.out": "Расход за сегодня",
  "account.txCount": "Транзакций: {n}",
  "account.inTransit.count": "В полёте · {n} тр-ций",

  "alerts.title": "Алёрты и рекомендации",
  "alerts.allClear": "Всё спокойно",
  "alerts.noAlerts": "Алёртов и предложенных переводов нет.",

  "autopilot.eyebrow": "Автопилот · Командный центр",
  "autopilot.title": "Очередь действий и риск-телеметрия",
  "autopilot.counter.queued": "В очереди: {n}",
  "autopilot.counter.confirm": "Подтверждение: {n}",
  "autopilot.counter.exec": "Исполняется: {n}",
  "autopilot.counter.done": "Готово: {n}",
  "autopilot.counter.skip": "Пропущено: {n}",
  "autopilot.demoMode": "Демо-режим",
  "autopilot.demoTooltip":
    "Синтезирует алёрты и переводы из текущих данных счетов для презентации — реальные действия с бэкендом не выполняются.",

  "autopilot.alerts.section": "Активные алёрты",
  "autopilot.alerts.count": "Алёртов: {n}",
  "autopilot.alerts.none": "Активных алёртов нет",
  "autopilot.alerts.noneDetail":
    "Прогнозируемые балансы выше минимума по всем счетам.",
  "autopilot.alerts.inDays": "через {n}д.",
  "autopilot.alerts.shortfall": "Нехватка",
  "autopilot.alerts.projected": "Прогноз",
  "autopilot.alerts.floor": "Минимум",

  "autopilot.queue.section": "Очередь переводов",
  "autopilot.queue.summary":
    "Активных: {active} · Готово: {done} · Пропущено: {skipped}",
  "autopilot.queue.empty": "Движок сейчас не предлагает переводов.",
  "autopilot.queue.allResolved": "Все действия обработаны.",
  "autopilot.queue.recentlyExecuted": "Недавно исполнено · {n}",
  "autopilot.queue.skippedSection": "Пропущено · {n}",
  "autopilot.queue.infoSection": "Открытые алерты · {n}",
  "autopilot.summary.label": "Счета",
  "autopilot.header.statusLine": "{pending} ожидает · {resolved} решено",
  "autopilot.session.accepted": "Принято",
  "autopilot.session.moved": "Перемещено",
  "autopilot.session.remaining": "Открытые алерты",
  "autopilot.alerts.dismiss": "Скрыть",
  "alert.message.critical":
    "В худшем случае {account} опустится до {projected} {date} — ниже требуемого минимума {min}. Дефицит: {shortfall}.",
  "alert.message.warning":
    "В ближайшие {days} дней типичный прогноз для {account} входит в зону буфера.",

  "action.execute": "Исполнить",
  "action.skip": "Пропустить",
  "action.confirmPrompt": "Подтвердить перевод?",
  "action.move": "Перевести {amount} с {from} на {to} через {rail}{initiateBy}.",
  "action.initiateBy": ", инициировать до {date}",
  "action.confirmExecution": "Подтвердить исполнение",
  "action.cancel": "Отмена",
  "action.autoRevert": "авто-сброс {n}с",
  "action.executingOn": "Исполнение через {rail}…",
  "action.settledOn": "Исполнено через {rail}",
  "action.skipped": "Пропущено",
  "action.restore": "Восстановить",
  "action.initiateAsap": "Срочно",
  "action.initiatePrefix": "до {date}",

  "empty.standingBy": "Автопилот в режиме ожидания",
  "empty.detail":
    "Действий не требуется. Все счета выше минимума, прогнозируемых нарушений в горизонте планирования нет. Включите {demo} в шапке, чтобы пройти сценарий с синтетическими данными.",

  "stub.contagion.title": "Сетевой риск",
  "stub.contagion.body": "Граф сетевого контагиона — будет в Phase 5.",
  "stub.timemachine.title": "Машина времени",
  "stub.timemachine.body":
    "Воспроизведение исторических сценариев — будет в Phase 6.",

  "timemachine.title": "Машина времени — стресс-тест",
  "timemachine.subtitle":
    "Выберите сценарий, настройте параметры, запустите симуляцию. Показываем базовый и стрессовый прогноз P50 по каждому счёту.",
  "timemachine.scenario": "Сценарий",
  "timemachine.scenarios.railDelay": "Задержка клиринга рельса",
  "timemachine.scenarios.volumeSpike": "Всплеск расхода (чарджбеки / выплаты)",
  "timemachine.scenarios.bankHoliday": "Банковский выходной",
  "timemachine.rail": "Рельс",
  "timemachine.extraDays": "Доп. дней клиринга",
  "timemachine.multiplier": "Множитель оттока",
  "timemachine.country": "Страна",
  "timemachine.holidayDays": "Дней выходных",
  "timemachine.runButton": "Запустить симуляцию",
  "timemachine.running": "Запуск...",
  "timemachine.totalImpact": "Совокупный эффект (USD)",
  "timemachine.newBreaches": "Новые пробои",
  "timemachine.breach": "Пробой",
  "timemachine.breachTooltip":
    "Пробой = стресс-прогноз ушёл ниже минимального резерва аккаунта. " +
    "В обычном прогнозе аккаунт под минимум не падает.",
  "timemachine.legend.baseline": "Базовый прогноз",
  "timemachine.legend.stress": "Под стрессом",
  "timemachine.legend.breach": "Пробой пола",
  "timemachine.baselineMin": "Базовый минимум",
  "timemachine.stressMin": "Стрессовый минимум",
  "timemachine.delta": "Дельта",
  "timemachine.hint.pickScenario":
    "Выберите сценарий и запустите симуляцию. Справа появятся карточки с эффектом на каждый счёт.",
  "timemachine.hint.railDelay":
    "Rail Delay — сдвиг clearing-окна рельса на N рабочих дней. Пример: SWIFT-корреспондент застрял на 3 дня — кто уходит в минус?",
  "timemachine.hint.volumeSpike":
    "Volume Spike — умножить расход по рельсу. Пример: чарджбеки по картам в 2× в ближайшие 7 дней.",
  "timemachine.hint.bankHoliday":
    "Bank Holiday — заморозка отходящего clearing'а на N дней в выбранной стране с последующим catch-up дропом.",
  "timemachine.summary.noBreaches": "Стресс прошёл — ни один счёт не свалился под минимум. Попробуй жёстче: {suggestion}.",
  "autopilot.queue.infoSectionHint": "Прогнозируемые пробои, которые движок не может закрыть автоматически — нет счёта-донора с излишком. Решает казначей вручную: кредитная линия / FX-своп / репо.",
  "radar.legend.totalInFlight": "{n} в полёте",

  "backend.alert.template":
    "{accountId}: прогноз {projected} {currency} к {breachDate}, ниже минимума {floor} (нехватка {shortfall}).",
  "backend.transfer.fund":
    "Пополнить {to} ({severity} к {breachDate}) со счёта {from} через {rail}.",
};

export default ru;
