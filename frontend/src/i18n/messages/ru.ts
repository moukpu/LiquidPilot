import type en from "./en";

const ru: Record<keyof typeof en, string> = {
  "app.title": "LiquidPilot — Прогнозный кокпит ликвидности",
  "app.description":
    "Управление воздушным движением для вашей казны. Радар, Автопилот, Сетевой риск и Машина времени.",

  "home.badge.live": "Живая демка",
  "home.title.line1": "Прогнозный кокпит",
  "home.title.line2": "ликвидности",
  "home.subtitle":
    "Главный командный центр казначейства. Радар в реальном времени, автономная балансировка, анализ сетевых рисков и исторические стресс-тесты.",
  "home.cta.enter": "Войти в кокпит",
  "home.cta.source": "Открыть исходники",
  "home.feature.radar.title": "Радар",
  "home.feature.radar.desc":
    "Диспетчерская вышка для всех денежных потоков по счетам и банкам — в реальном времени.",
  "home.feature.autopilot.title": "Автопилот",
  "home.feature.autopilot.desc":
    "Автоматическая балансировка ликвидности — без ручных операций, всегда в зелёной зоне.",
  "home.feature.contagion.title": "Сетевой риск",
  "home.feature.contagion.desc":
    "Скоринг сетевого контагиона на графе bilateral exposures между банками.",
  "home.feature.timemachine.title": "Машина времени",
  "home.feature.timemachine.desc":
    "Воспроизведение исторических кризисов и стресс-тест казны против прошлых событий.",

  "profile.menu.demo": "Демо-аккаунт",
  "profile.menu.settings": "Настройки",
  "profile.menu.signOut": "Выйти",
  "profile.demoBadge": "Демо",

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
  "autopilot.demoMode": "Демо-режим",
  "autopilot.demoTooltip":
    "Синтезирует алёрты и переводы из текущих данных счетов для презентации — реальные действия с бэкендом не выполняются.",
  "autopilot.autoMode": "ИИ-пилот",
  "autopilot.autoTooltip":
    "Автономный режим: ИИ сам исполняет переводы, не дожидаясь подтверждения. Каждое действие логируется ниже — выключите тумблер, чтобы взять управление обратно.",
  "autopilot.log.title": "Журнал решений ИИ",
  "autopilot.log.empty":
    "Включите ИИ-пилот, чтобы движок начал автоматически выполнять переводы. Все действия будут отображаться здесь.",
  "autopilot.log.executed":
    "Переведено {amount} с {from} на {to} через {rail} — закрывает прогнозируемый дефицит на {date}.",
  "autopilot.log.skipped":
    "Отложен перевод {amount} {from} → {to}: надёжность рельса {rail} ниже порога.",
  "autopilot.log.noAction":
    "Сканировано счетов: {n} — все балансы выше минимума, переводы не требуются.",
  "autopilot.log.shown": "Показаны последние {n} действий",
  "autopilot.log.clear": "Очистить",

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
  "timemachine.scenarios.fxShock": "FX-шок (движение кросс-курса)",
  "timemachine.scenarios.counterpartyDefault": "Дефолт контрагента",
  "timemachine.scenarios.liquidityFreeze": "Заморозка счёта",
  "timemachine.fxCurrency": "Валюта",
  "timemachine.fxShockPct": "Магнитуда шока (%)",
  "timemachine.counterparty": "Счёт-контрагент",
  "timemachine.frozenAccount": "Замороженный счёт",
  "timemachine.freezeDays": "Дней заморозки",
  "timemachine.hint.fxShock":
    "FX Shock — резкая девальвация выбранной валюты режет каждый счёт в ней на заданную магнитуду. Пример: EUR теряет 5% к USD после заявления ЕЦБ.",
  "timemachine.hint.counterpartyDefault":
    "Counterparty Default — конкретный контрагент перестаёт исполнять обязательства. Входящие потоки от этого счёта обнуляются на горизонте.",
  "timemachine.hint.liquidityFreeze":
    "Liquidity Freeze — один счёт полностью заморожен (санкции, fraud-hold). Все входящие/исходящие останавливаются, баланс стоит, а затем уходит вниз под исходящими обязательствами.",
  "timemachine.method.fxShockPct": "Шок %",
  "timemachine.method.fxAffectedAccounts": "Счетов в валюте",
  "timemachine.method.frozenAccount": "Замороженный счёт",
  "timemachine.method.freezeDays": "Дней заморозки",
  "timemachine.method.exposureUsd": "Экспозиция (USD)",
  "timemachine.reason.currencyMismatch": "валюта счёта не совпадает с валютой шока",
  "timemachine.reason.notFrozenAccount": "это не замороженный счёт",
  "timemachine.reason.zeroShock": "магнитуда шока равна 0 — эффекта нет",
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
  "timemachine.methodologyLabel": "Методика",
  "timemachine.method.notApplied": "Не применимо",
  "timemachine.method.sample": "Выборка",
  "timemachine.method.days": "дн",
  "timemachine.method.avgInflow": "Средний приход {rail}",
  "timemachine.method.avgOutflow": "Средний отток {rail}",
  "timemachine.method.daysAffected": "Дней затронуто",
  "timemachine.method.shiftPerDay": "Сдвиг в день",
  "timemachine.method.multiplier": "Множитель",
  "timemachine.method.extraPerDay": "Доп. OUT/день",
  "timemachine.method.country": "Праздник",
  "timemachine.method.dailyNetOutflow": "Чистый отток/день",
  "timemachine.method.deferred": "Отложенный отток",
  "timemachine.method.fxFactor": "Множитель",
  "timemachine.method.fxMagnitude": "Магнитуда",
  "timemachine.method.counterparty": "Контрагент",
  "timemachine.method.dailyOutflow": "Ежедневный отток",
  "timemachine.method.dailyInflow": "Ежедневный приход",
  "timemachine.method.exposureFrac": "Доля экспозиции",
  "timemachine.method.lossPerDay": "Потери/день",
  "timemachine.method.selfDefault": "Само-дефолт",
  "timemachine.method.queuedDrag": "Накопленная очередь",
  "timemachine.method.amplification": "Усиление",
  "timemachine.hint.pickScenario":
    "Выберите сценарий и запустите симуляцию. Справа появятся карточки с эффектом на каждый счёт.",
  "timemachine.hint.railDelay":
    "Rail Delay — сдвиг clearing-окна рельса на N рабочих дней. Пример: SWIFT-корреспондент застрял на 3 дня — кто уходит в минус?",
  "timemachine.hint.volumeSpike":
    "Volume Spike — умножить расход по рельсу. Пример: чарджбеки по картам в 2× в ближайшие 7 дней.",
  "timemachine.hint.bankHoliday":
    "Bank Holiday — заморозка отходящего clearing'а на N дней в выбранной стране с последующим catch-up дропом.",
  "timemachine.reason.noInboundOnRail": "по этому рельсу нет входящих транзакций для этого счёта",
  "timemachine.reason.noOutboundOnRail": "по этому рельсу нет исходящих транзакций для этого счёта",
  "timemachine.reason.countryMismatch": "страна счёта не совпадает со страной праздника",
  "timemachine.reason.zeroMultiplier": "множитель ≤ 1 — всплеска нет",
  "timemachine.reason.unknown": "сценарий неприменим",
  "timemachine.reason.noCounterpartySelected": "контрагент не выбран",
  "timemachine.reason.noFrozenSelected": "замороженный счёт не выбран",
  "timemachine.reason.zeroFreezeDays": "дней заморозки = 0 — нет эффекта",
  "timemachine.reason.zeroHolidayDays": "дней праздника = 0 — нет эффекта",
  "timemachine.reason.noInbound": "у счёта нет входящих транзакций",
  "timemachine.reason.noOutbound": "нет исторических OUT — траектория плоская",
  "timemachine.reason.noFilterMatch": "нет исходящих транзакций под фильтр",
  "timemachine.reason.emptyHorizon": "пустой горизонт прогноза",
  "timemachine.empty.title": "Нет затронутых счетов",
  "timemachine.empty.railNotUsed":
    "Ни один счёт в портфеле не получает входящие по {rail}. Выберите другой рельс, чтобы увидеть эффект.",
  "timemachine.empty.noOutbound":
    "Нет исходящих транзакций под выбранный фильтр. Расширьте охват или смените рельс.",
  "timemachine.empty.noCountryAccount":
    "Нет счетов, открытых в стране {country}. Выберите страну, где портфель присутствует.",
  "timemachine.empty.hint":
    "Симуляция отработала успешно, но при этих параметрах эффект на счета не возникает.",
  "timemachine.skippedAccounts": "{n} счетов пропущено (сценарий неприменим)",
  "autopilot.queue.infoSectionHint": "Прогнозируемые пробои, которые движок не может закрыть автоматически — нет счёта-донора с излишком. Решает казначей вручную: кредитная линия / FX-своп / репо.",
  "radar.legend.totalInFlight": "{n} в полёте",

  "backend.alert.template":
    "{accountId}: прогноз {projected} {currency} к {breachDate}, ниже минимума {floor} (нехватка {shortfall}).",
  "backend.transfer.fund":
    "Пополнить {to} ({severity} к {breachDate}) со счёта {from} через {rail}.",

  "contagion.title": "Сетевой риск — симулятор каскада",
  "contagion.subtitle":
    "Уроните контрагента — увидите как шок пройдёт по сети ваших bilateral exposures. Эпидемиология банков для ликвидности.",
  "contagion.hero.summary": "{loss} · {affected} затронуто · {breached} пробито",

  "contagion.shock.title": "Управление шоком",
  "contagion.shock.account": "Уронить контрагента",
  "contagion.shock.intensity": "Интенсивность",
  "contagion.shock.horizon": "Горизонт (дней)",
  "contagion.shock.run": "Запустить каскад",
  "contagion.shock.running": "Запуск...",
  "contagion.shock.reset": "Сброс",

  "contagion.result.title": "Результат каскада",
  "contagion.result.empty":
    "Выберите контрагента слева и запустите симуляцию. Пострадавшие счета появятся здесь со статусом пробоя и хоп-дистанцией.",
  "contagion.result.breachedCount": "Пробои",
  "contagion.result.totalLoss": "Совокупный убыток (USD)",
  "contagion.result.affectedCount": "Затронуто счетов",
  "contagion.result.hopBadge": "хоп {n}",
  "contagion.result.hopGroup": "Хоп {n} (×{count})",
  "contagion.result.postBalance": "После шока",
  "contagion.result.minBalance": "Минимум",
  "contagion.result.loss": "Убыток",
  "contagion.result.via": "через",

  "contagion.node.shocked": "Шок",
  "contagion.node.breached": "Пробой",
  "contagion.node.affected": "Затронут",
  "contagion.node.idle": "Норма",

  "contagion.legend.title": "Легенда",
  "contagion.edge.kind.intra-group": "Внутри группы",
  "contagion.edge.kind.correspondent": "Корреспондент",
  "contagion.edge.kind.market": "Рыночный",

  "contagion.error.engineWarming":
    "Движок ещё прогревается. Подождите ~30 секунд и нажмите Запустить снова.",
  "contagion.error.network":
    "Не удалось загрузить граф контагиона с бэкенда.",
  "contagion.tip.clickNode":
    "Подсказка: кликните по узлу на графе — он автоматически выберется как контрагент.",
  "contagion.edge.detail.title": "Детали экспозиции",
  "contagion.edge.detail.from": "От",
  "contagion.edge.detail.to": "К",
  "contagion.edge.detail.amount": "Bilateral exposure",
  "contagion.edge.detail.kind": "Тип",
  "contagion.edge.detail.why":
    "Если счёт-источник перестаёт платить, эта экспозиция превращается в моментальную потерю ликвидности у получателя.",
  "contagion.edge.detail.close": "Закрыть",
  "contagion.node.detail.title": "Карточка счёта",
  "contagion.node.detail.balance": "Текущий баланс",
  "contagion.node.detail.floor": "Минимум",
  "contagion.node.detail.outDeg": "Исходящих экспозиций",
  "contagion.node.detail.inDeg": "Входящих экспозиций",
  "contagion.page.subtitle": "Симулятор каскада",
  "contagion.metric.affected": "Затронуто",
  "contagion.metric.breached": "Пробито",
  "contagion.result.impactAnalysis": "Анализ ущерба",
  "contagion.result.emptyState": "Запустите симуляцию каскада, чтобы увидеть цепную реакцию.",
  "contagion.result.floorLabel": "Мин:",
  "contagion.result.postLabel": "Остаток:",
  "contagion.result.hopShort": "H{n}",
  "contagion.loading": "Загрузка графа...",
  "contagion.loadingTopology": "Загрузка топологии сети...",
};

export default ru;
