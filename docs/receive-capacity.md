# спектрум входящей ёмкости

Дата: 2026-09-05. Исследован SHA `b97c454d605e750a08da7ff6baab645330175468`.
Статус: Receive и Pay→Move проверены настоящим браузером; lease-протокол ещё не реализован.
Область: React `/ui`, получение в двустороннем Account, receive/swap/cross-j/lending.
Последнее решение владельца: Spectrum только на входе. На Pay — переход в заполненный Move.
Нормативные ограничения остаются в [fints.md](fints.md) и [consensus-invariants.md](consensus-invariants.md).

## решение в одном экране

Один контрол отвечает на вопрос: **«Чем подготовить недостающую ёмкость для получения?»**
Слева — 100% залога хаба, справа — 0% залога и постоянный кредит пользователя хабу.
Настройка применяется к недостающей части конкретной операции, а не ко всему балансу.
Ниже целевой макет; доступность залогового действия ограничена текущим протоколом, см. далее.

```text
Подготовить приём                      1 000 USDT · Ethereum
Доступно 600 · Нужно ещё 400                           Через H2

100% залог                                        0% залог
●────────────────────────────────────────────────────────
Залог 400 USDT · Дополнительно без залога 0 USDT

Комиссия: … USDT · Готовность: после подтверждения
[ Запросить залог ]
```

Ценность решения: **910/1000** — субъективная оценка полезности, не измерение пользователей.
Причина: один выбор заменяет разрозненные ручные переходы в Manage и скрытый credit setup.
Условие полезности: Runtime действительно умеет выполнить выбранный способ до операции.

## что уже найдено в коде

| Наблюдение                                              | Доказательство                                                                                                       | Следствие                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Текущий wallet — React `/ui`                            | [App.tsx:72](../ui/src/App.tsx#L72), [vite.config.ts:48](../ui/vite.config.ts#L48)                                   | Интегрировать в React; не проектировать новую Svelte-оболочку |
| Wallet строится из committed view frame                 | [views.ts:15](../ui/src/runtime/views.ts#L15), [views.ts:157](../ui/src/runtime/views.ts#L157)                       | Capacity и состояния брать из одного подтверждённого среза    |
| Receive суммирует inbound нескольких Accounts           | [Receive.tsx:53](../ui/src/screens/Receive.tsx#L53)                                                                  | Эта сумма не доказывает capacity одного маршрута              |
| Pay выбирает один маршрут/первый hop                    | [Pay.tsx:117](../ui/src/screens/Pay.tsx#L117), [payments.ts:35](../ui/src/runtime/financial/payments.ts#L35)         | Отдельно проверять source outbound и target inbound           |
| Receive предлагает credit только при нулевой capacity   | [Receive.tsx:106](../ui/src/screens/Receive.tsx#L106)                                                                | Частичный дефицит пока не получает решения                    |
| Cross-j показывает автоматические account/credit steps  | [Swap.tsx:159](../ui/src/screens/Swap.tsx#L159), [Swap.tsx:409](../ui/src/screens/Swap.tsx#L409)                     | Заменить implicit credit явным общим выбором                  |
| Manage передаёт точную fee policy                       | [manage.ts:20](../ui/src/runtime/financial/manage.ts#L20), [manage.ts:30](../ui/src/runtime/financial/manage.ts#L30) | Использовать опубликованную committed policy и её версию      |
| «Request credit» просит кредит у хаба                   | [manage.ts:170](../ui/src/runtime/financial/manage.ts#L170)                                                          | Нужное направление для SEND, не для RECEIVE                   |
| «Extend credit» разрешает хабу долг перед пользователем | [AccountDetail.tsx:469](../ui/src/screens/AccountDetail.tsx#L469)                                                    | Это нужное направление кредитной части                        |
| Глобальный receipt появляется после завершения          | [receipts.ts:99](../ui/src/runtime/financial/receipts.ts#L99)                                                        | Receipt нельзя использовать как предварительное согласие      |

Старый [CollateralForm.svelte:36](../frontend/src/lib/components/Entity/account/ui/CollateralForm.svelte#L36) показывает минуты и `$1 per $100 per hour`.
[Payload:219](../frontend/src/lib/components/Entity/account/ui/CollateralForm.svelte#L219) не содержит срок: только `amount`, `feeTokenId`, `feeAmount`, `policyVersion`.
**Это не доказательство существующей аренды по времени.** Не переносить оценку/таймер в новую фичу.

Проверка core уточняет границу существующей функциональности:

- Payload фиксирует gross/fee; `requestedRebalance` хранит net после fee в том же токене.
  Hub scheduler ограничивает исполнение существующим необеспеченным долгом; при нуле не финансирует будущий приём.
  [rebalance.ts:244](../core/entity/scheduler/rebalance.ts#L244).
- Свободный излишек collateral попадает в автоматический C→R plan; сохранение арендованной ёмкости не реализовано.
  [rebalance.ts:437](../core/entity/scheduler/rebalance.ts#L437).
- `set_credit_limit` задаёт абсолютный постоянный limit, не добавляет сумму и не ограничивает
  разрешение одной операцией. [set-credit-limit.ts:40](../core/account/tx/handlers/balance/set-credit-limit.ts#L40).
- Borrow даёт credit для отправки, а не перевод principal на Account получателя.
  Реальные переводы — `lending_fund`, `lending_repay`, `lending_close_payout`.
  [lending.ts:76](../core/account/tx/handlers/balance/lending.ts#L76), [lending.ts:151](../core/account/tx/handlers/balance/lending.ts#L151).

**Аренда будущей inbound capacity требует protocol work.** Собственный R→C для SEND уже имеет путь.
До реализации аренды RECEIVE preview показывает её недоступность и не отправляет неподходящий rebalance.

## входящий выбор и простое пополнение перед платежом

RECEIVE: «Арендовать залог» / «Арендовать залог и увеличить лимит» / «Увеличить лимит хабу».
Аренда требует принятой хабом котировки и исполнимого обязательства; свой grant подписывает пользователь.
Grant не переводит деньги: долг возникает при использовании. Показывать риск долга хаба.
Пока lease отсутствует, залоговый вариант объяснимо недоступен, а не заменён кредитом.

SEND: **никакого Spectrum или нового запроса кредита**. Кнопка «Пополнить для платежа»
открывает существующий [Move](../ui/src/screens/Move.tsx) с account, J, token и рассчитанной
суммой. Источник — свой reserve; при его недостатке можно выбрать on-chain wallet.
Move использует существующий канонический путь и свою подпись. После committed пополнения
пользователь возвращается к сохранённому получателю/сумме для новой котировки и подтверждения Pay.
Пополнение не означает разрешение автоматически отправить платёж.

Сумму R→C считает Runtime projection: старый долг/credit может поглотить часть депозита.
Недостающая route fee при отсутствии маршрута явно неизвестна; не выдавать предварительную
сумму за точную all-in. Ошибка/отмена Move сохраняет черновик, но не открывает Pay по toast.
Return destination ограничен локальным Pay; параметры не разрешают внешний redirect.
Смена Entity/Account/J/token требует новой проверки, а не продолжения со старыми полномочиями.

Существующий credit API остаётся отдельным Manage-путём. Найденные риски его `alreadySatisfied`
и абсолютного grant описаны в [credit.ts:82](../core/api/server/faucet/credit.ts#L82);
новый Pay не использует этот API и не маскирует проблему frontend-обходом.

## точный смысл выбора

Идентичность: Runtime → Entity → jurisdiction → counterparty Account → token; одинаковый символ в разных J не объединяет активы.

- `A` — admission/hold новой операции с её fees; существующие holds уже учтены в `C` и не прибавляются снова.
- `C` — `inCapacity` выбранного Account, с учтёнными holds/allowances.
- `D = max(0, A − C)` — показываемая пользователю недостающая часть.
- Ползунок распределяет `D` между обеспечением и дополнительным необеспеченным допуском.

Формула объясняет UX; расчёт остаётся в Runtime через `deriveDelta`.
`A` — полный входящий admission/hold с округлением, не красивое expected/min-net число.

Пример: ожидается 1 000; сейчас доступно 600; дефицит 400; выбран залог 75%.
На экране: «300 залог + 100 дополнительно без залога» для дефицита 400.
Не обещать «75% всего платежа обеспечено»: существующие 600 могут включать ранее выданный credit; показывать итоговую позицию.

«300 залог» — целевой результат, не размер R→C: депозит сначала может покрыть старый долг; fee тоже меняет Delta.
Вместо `deposit = D × share` planner проецирует canonical Delta после fee/deposit и повторно вычисляет capacity/риск.

**Постоянный Account limit одобрен владельцем.** Согласие показывает старый → новый абсолютный limit;
подготовка конкретного платежа не означает автоматический откат limit после платежа.
Существующий grant и ранее принятый риск не уменьшаются скрытно.

Решение владельца от 2026-09-06: буфер +10% **на весь требуемый лимит**, по умолчанию
включённый, видимый и отключаемый. Это заменяет прежний буфер только нового increment.
После canonical projection/split: `required = currentLimit + requiredIncrease`,
`newLimit = required + ceil(required/10)`. Например, 100 → требуемые 150 → новый limit 165.
Расчёт preview не изменяет Account и не начисляет новые 10% при каждом refresh.
При 100% collateral или `D=0` буфер равен нулю: он не создаёт скрытый credit/rental-запрос.
Последующее решение владельца: произвольный `FINANCIAL.MAX_CREDIT_LIMIT` удалён.
Кредит использует полный формат uint256. Прежний потолок не ограничивает ни нужное
увеличение, ни +10%. Только у границы самого uint256 необязательный буфер уменьшается
до представимого остатка; planner возвращает отдельно запрошенный и фактический буфер.
Нужная для операции сумма не уменьшается. Если уже она не помещается в числовой формат,
planner возвращает явную ошибку без команды. Это не ограничение суммы продукта.

Default владельцем уже задан: 100% залога; новая операция или смена Account/token/jurisdiction возвращает его.
Сохранение risk preference на будущее — отдельное явное действие, не побочный эффект drag.

## комиссия: gross, net, время

Текущий Manage показывает `net = gross − fee`; fee включает base, gas и долю gross.
Источники: [manage.ts:26](../ui/src/runtime/financial/manage.ts#L26), [AccountDetail.tsx:202](../ui/src/screens/AccountDetail.tsx#L202).

Пользователь выбирает полезный результат, поэтому planner возвращает отдельно:

- сколько дополнительного обеспечения требуется;
- gross запроса, точную fee, net получаемого collateral и token оплаты;
- новый credit limit, дополнительный необеспеченный риск и условия готовности;
- доступность способа, evidence fee policy и причину отказа.

Нельзя обещать net `D` при gross `D` и вычитаемой fee; расчёт gross целочисленный и канонический, не UI-формула.
Отсутствующая policy или недостаточная ликвидность делают вариант недоступным.
`fee ≥ gross` запрещает выбранный вариант при одинаковом token; суммы разных токенов
так не сравниваются. При отдельном fee token запрос collateral остаётся `amount`.
Текущий handler также требует положительную fee и достаточную исходящую capacity для её оплаты:
[request-collateral.ts:89](../core/account/tx/handlers/rebalance/request-collateral.ts#L89).
Нельзя молча сдвигать выбор вправо, чтобы заменить недоступный залог кредитом.
Решение владельца от 2026-09-06: **обеспечение под конкретный запрос с таймаутом**,
с котировкой хаба. Отдельная аренда на произвольный срок в v1 не входит.
Quote связывает запрос, сумму, fee, deadline, J-clock и условия освобождения collateral.
Продолжительность задаётся выбранным J block/timestamp, не таймером вкладки; расчёт UI — только ETA.
Оплачивается подготовленная ёмкость, не бесконечное пополнение; занятая платежом часть не снова свободна.
Expiry не возвращает хабу обеспечение пользовательского требования и не отменяет уже подписанный долг.
База экономической модели и значение margin +5%, защита от griefing, expiry/refund — отдельная спецификация
`docs/liquidity-lease.md`; этот документ не выдумывает ставку или уже действующее обязательство хаба.

## где показывать

| Поток                                           | Размещение и действие                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Receive с известной суммой                      | Под суммой, до обещания готовности invoice; выбрать входящий Account                                                                            |
| Receive без суммы                               | Показать доступность; предложить указать сумму или отдельно подготовить лимит                                                                   |
| Pay                                             | Свой дефицит → заполненный Move; чужой inbound нельзя исправить чужой подписью                                                                  |
| Same-j swap                                     | Spectrum только для want-token; give-token финансируется отдельно через Move                                                                    |
| Cross-j swap                                    | Spectrum только target RECEIVE на своём Entity/hub/J; source пополняется через Move                                                             |
| Borrow                                          | Grant увеличивает outbound, это не получение principal и не повод для Spectrum                                                                  |
| Lending fund/repay/close payout                 | Spectrum у реального получателя; для lender — close payout, для hub — fund/repay                                                                |
| Move external/reserve→Account                   | Проверить allocation; собственный outCollateral не доказывает inbound. Не оплачивать обеспечение повторно, если нужная allocation уже создаётся |
| Manage                                          | Тот же primitive для ожидаемой суммы; ручные advanced controls отдельно                                                                         |
| Open account                                    | Те же понятия; существующую auto-rebalance policy не менять скрытно                                                                             |
| Уже завершённая операция                        | Только результат; поздний slider не изменяет подписанный перевод                                                                                |
| Перевод токена на обычный EVM address/в reserve | Нет Account shortfall: этот primitive не нужен                                                                                                  |

Опорные операции: [swap.ts:121](../ui/src/runtime/financial/swap.ts#L121), [Lending.tsx:69](../ui/src/screens/Lending.tsx#L69),
[move.ts:209](../ui/src/runtime/financial/move.ts#L209), [Home.tsx:435](../ui/src/screens/Home.tsx#L435).
Направление collateral задаёт allocation: [Depository.sol:774](../jurisdictions/contracts/Depository.sol#L774), [utils.ts:26](../core/account/utils.ts#L26); R→C сам по себе не означает готовность приёма.
Cross-j slider не меняет `route.riskMode`: это другой protocol-параметр, где сейчас допустим
только `fully_collateralized`, хотя Account admission проверяет общую capacity с credit: [cross-j/index.ts:325](../core/extensions/cross-j/index.ts#L325).

## взаимодействие и состояния

Drag изменяет preview; отправка происходит только по явному CTA.
CTA показывает входящий выбор из таблицы выше; аренда доступна только по настоящей quote.
Под credit CTA видны постоянный limit, буфер и то, кто кому сможет быть должен.

| Состояние                          | Что видит пользователь                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `D = 0`                            | «Готово к приёму»; slider свёрнут или неактивен; нет лишнего CTA                                   |
| Account не выбран                  | Выбор хаба/юрисдикции; общая wallet capacity не заменяет его                                       |
| Расчёт                             | Сумма и выбранная доля сохраняются; отправка закрыта до результата                                 |
| Залог недоступен                   | Конкретная причина и явно выбираемые альтернативы                                                  |
| Условия изменились                 | Новый расчёт; рост fee/риска требует нового подтверждения                                          |
| Отправлено                         | «Условия приняты» → «Ожидаем хаб» при необходимости → «J отправлена» → «Подтверждается» → «Готово» |
| Частичный успех                    | Видно, какие действия уже committed; закрытие окна их не отменяет                                  |
| Timeout/ошибка                     | Причина Runtime, сохранённый выбор, безопасное продолжение по фактическому состоянию               |
| Recovery/dispute/offline           | Причина блокировки; отсутствие оптимистичной готовности                                            |
| Swap quote устарела при ожидании J | Новая котировка перед swap; прежняя цена не обещается                                              |

Переход в «Готово» зависит от committed Account/J state, а не HTTP 200, submit или toast.
Изменение маршрута, token, policy, holds либо поступление параллельного платежа требует пересчёта.
При повторе UI должен продолжать уже подписанное действие, а не создавать вторую оплату комиссии.
Для ордеров с поздним/частичным исполнением нельзя обещать вечную capacity по разовому preview.
Автоматизация продолжает подготовку без ручного обновления и возвращает исходную операцию к исполнению.
Показывать ETA диапазоном по наблюдаемой цепочке; при задержке обновлять оценку и объяснять этап.
Ноль на countdown не означает готовность: только committed J/Account evidence открывает действие.

Необъявленное получение — отдельный admission-вопрос; terminal receipt не является предварительным уведомлением.
При нехватке capacity нельзя автоматически выдать credit от имени получателя,
зависнуть внутри RJEA до клика или утверждать, что отклонённый перевод «ждёт».
Первый путь: invoice/quote и корректный retry; фоновый запрос требует явного intent/admission-протокола.

## внешний вид и доступность

Локальный liquid-glass акцент: **890/1000**. Стеклянная подложка всех денежных чисел: **620/1000**.
Это субъективная оценка. Текущий default — matte Obsidian; blur уже используется в мобильной навигации.
Источники: [design.ts:23](../ui/src/runtime/design.ts#L23), [app.css:122](../ui/src/styles/app.css#L122).

- Track: `--coll`; кредитная часть RECEIVE — `--risk`.
- Стекло: ручка/лёгкий блик/тонкая граница; цифры и fee на стабильной читаемой подложке.
- Native HTML range; вправо увеличивается доля без залога, видимый collateral% уменьшается.
- Видимые подписи концов, label, значения в token; цвет никогда не единственный носитель смысла.
- Touch-зона 44px, keyboard arrows/Home/End, presets 100/50/0 и точный числовой ввод.

`aria-valuetext`: «75% залога: 300 USDT; без залога: 100 USDT»; каждый pixel drag не озвучивается как тревога.
Сохранить light/dark/material presets, focus ring и `prefers-reduced-motion`.
Источники: [tokens.css:39](../ui/src/styles/tokens.css#L39), [base.css:65](../ui/src/styles/base.css#L65).
Inline-card предпочтителен; [Sheet.tsx:16](../ui/src/components/Sheet.tsx#L16) пока не реализует focus trap/restore/inert siblings.

## границы реализации: три владельца, один путь

Предлагаемые интерфейсы ниже — проект, не уже существующие API.

| Владелец             | Принимает                                                      | Возвращает/делает                                                          |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Runtime planner      | Incoming capacity intent, committed evidence, доля/буфер/quote | Валидированный preview/отказ, canonical commands и условия готовности      |
| React component      | Preview, статус, callbacks выбора/подтверждения                | Только визуализация и пользовательский выбор; без env/tx/финансовых формул |
| Frontend coordinator | Intent и подтверждённый plan                                   | Отправка через adapter, наблюдение committed state, пересчёт/статусы       |

Receive/Swap/Lending передают входящий intent; component не импортирует эти экраны.
Pay использует отдельную проекцию существующего Move, без кредитного выбора.
При недостаточной source capacity read-only funding quote использует тот же PathFinder:
он разрешает пополнение только выбранного первого Account и проверяет точные комиссии
и реальную ёмкость остальных рёбер. Обычный Pay admission не меняется. В Move передаётся
сумма с комиссиями; после J-confirmation возвращается сохранённый платёж для проверки.
Канонический расчёт обобщён в [capacity-plan.ts](../core/account/capacity-plan.ts).
Этот путь заменяет прежний swap-specific planner; второй финансовой формулы в UI нет.
Planner проверяет authority, идентичность Account, fee, rounding и допустимость выбранного риска.
Runtime сохраняет владение WAL/outbox; frontend не добавляет долговечную финансовую очередь.
Новая UI-настройка не требует нового поля AccountState, пока такое поле не доказано протоколом.
Один implementer владеет каждой областью; общие интерфейсы меняются согласованно.
Reviewer подключается после стабильного diff; stand, formatting, commit выполняются последовательно.

## решения до production-реализации

Решено: общий RECEIVE primitive, Pay → заполненный Move → подтверждение Pay,
default 100% collateral, shortfall, React `/ui`,
постоянный grant, обеспечение под запрос с таймаутом и hub quote, автоматизация и ETA до J-finality.
Не спрашивать это повторно; buffer применяется ко всему требуемому credit limit.
Экономика исполнения запроса и возврата ещё проектируется.
Он должен определить margin +5%, clock/start/expiry, fee при отказе, griefing, release/refund и recovery.
Первый путь — invoice/quote-first; фоновый incoming intent не появляется как скрытая UI-доработка.
Существующий requestCollateral нельзя переименовать в lease без реализации этих свойств.

## приёмка

| Проверка              | Обязательное доказательство                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Credit direction      | RECEIVE: свой grant хабу; queued/committed различаются; Pay не запрашивает credit                                |
| Shortfall             | Обе LEFT/RIGHT стороны, ноль, частичный дефицит, несколько Accounts, holds и существующий unsecured credit       |
| Endpoints и rounding  | 100/75/50/0%, точный buffer on/off, без hidden grant на 100%, fee gross/net/отдельный token                      |
| Stale evidence        | Смена policy/route/token/jurisdiction/holds между preview и submit                                               |
| Unavailable funding   | Нет policy, недостаток reserve, отказ хаба; нет скрытого перехода к credit                                       |
| Async/recovery        | Crash после submit/fee/credit/J, повторный клик, retry; нет двойного списания                                    |
| Операции              | RECEIVE/swap/cross-j/lending; Borrow без fake receive; Pay сохраняется через Move и требует нового подтверждения |
| Длительное исполнение | Partial fill/expiry/cancel не оставляют необъяснимый риск или вечную гарантию capacity                           |
| Browser               | Mobile/desktop, light/dark, keyboard/screen reader, console, reduced motion, ETA≠finality                        |

Сначала smallest failing boundary, затем production-equivalent сценарий, затем общий `bun run check`.
Настоящий React-прогон R10 (`/tmp/xln-react-capacity-1788573224783`) проверил Receive:
25 USDC → явный постоянный grant 27.5, и Pay→Move: 25.000025 с комиссией → один batch
→ возврат к доступному Pay без автоотправки. Startup 17.970 с, browser process 10.956 с,
0 page/MAC/auth errors и activity-view gap warnings. Прогон включает исправление
funding quote с разными fee на рёбрах и асинхронное чтение native transport config.
Обычный Swap отдельно прошёл через свежий кошелёк за 24.100 с со стартом:
199.999992 USDC списано, 0.0799760016 WETH получено, постоянный лимит 0.0879824 WETH,
ноль pending work. Артефакт: `/tmp/xln-react-swap-1788573446670/browser.log`.
Lending браузерный сценарий и исполнение lease пока не доказаны.
Этот документ не заявляет финансовую, браузерную или release-готовность фичи.

## cross receive: фактическое исполнение и раскрытие комиссии

2026-09-05, React Cross R10: свежий кошелёк, два собственных Entity, два реальных
Account с H1, две локальные EVM-юрисдикции. Название второй сети `Tron` здесь
обозначает второй Anvil; этот прогон **не доказывает native TVM**.
Тест: [e2e-cross-swap.spec.ts](../ui/tests/e2e-cross-swap.spec.ts).
Артефакт: `/tmp/xln-react-cross-swap-1788576931486/browser.log`;
скриншот: `/tmp/xln-cross-receive-spectrum.png`. Startup 18.820 с, browser 8.319 с,
1 pass, 0 page/MAC/auth errors. Это доказательство конкретного пути, не release gate.

| Проверка | Фактический результат |
| --- | --- |
| Default | Slider 0: 100% collateral; Swap закрыт |
| Явный выбор | `Accept it as credit instead` меняет только выбор на 0% collateral; assets/credit/routes не меняются |
| Отдельное согласие | `Extend credit limit`: 0 → 11,218.878 USDT, включая +10%; до manual Swap сделки нет |
| Реальная котировка | Существующий MM order: 10,200 USDC@Testnet → 10,198.98 USDT@Tron |
| Исходные средства | Faucet 20,000 USDC; после штатного rebalance 19,997.90 собственных средств; 2.10 разницы сохранены отдельно |
| Исполнение | Обе committed routes `settled`; source debit 10,200 USDC; gross filledTarget 10,198.98 USDT |
| Получение | Net 10,197.860102 USDT + signed rebalance fee 1.119898 USDT = gross 10,198.98 USDT |
| Доказательство fee | Target Account frame 6, `request_collateral`, token/feeToken 3, amount 10,198.98, policyVersion 1; root `0x3b79c0767b250511094ee279ee89aa2e01a3bd05ebf8dcc28f9b99acdd0cba8b` |
| После исполнения | Debt/pending/mempool/pulls = 0 на обеих ногах; постоянный credit limit сохранён |

Fee взята из подтверждённой Account frame history одним чтением после исполнения.
Это необходимо, поскольку `requestedRebalanceFeeState` удаляется после J-finality.
Собственные активы считаются через `deriveDelta.outCollateral + outPeerCredit` при
`inOwnCredit = 0`; outCapacity включает чужой кредит и не считается балансом.
Raw collateral/ondelta/offdelta сохранены до и после операции.

**UX/consent gap, зафиксированный до исправления в R10:** интерфейс не раскрывал платный
auto-rebalance после получения. Точные строки: `You receive` — `10198.98`;
`H1 pays 10,198.98 USDT into your account there`; `Atomic · both legs or neither`.
Spectrum сначала сообщает `Collateral for a future receipt is not available yet.
No fee is charged. You can explicitly choose credit, or wait for collateral support.`
После выбора кредита раскрываются permanent limit и +10% buffer, но не auto-rebalance fee.
В Cross режиме блок `Hub fee` вообще не отображается: [Swap.tsx:174](../ui/src/screens/Swap.tsx#L174),
[Swap.tsx:403](../ui/src/screens/Swap.tsx#L403), [Swap.tsx:546](../ui/src/screens/Swap.tsx#L546).
Само равенство net + signed fee = gross не закрывало этот gap.

Уже существующий UI preview обычного collateral request —
`counterpartyFeePolicy` + `collateralFee` в [manage.ts:20](../ui/src/runtime/financial/manage.ts#L20),
используемый в [AccountDetail.tsx:260](../ui/src/screens/AccountDetail.tsx#L260).
Каноническое автоматическое решение — `checkAutoRebalance` в
[request-collateral.ts:192](../core/account/tx/handlers/rebalance/request-collateral.ts#L192):
оно учитывает фактический post-receipt `outPeerCredit`, local policy/threshold/max fee,
уже существующий запрос, pending frame и settlement. Готового preview именно будущего
auto-rebalance не найдено; ручной preview нельзя выдавать за гарантированное списание.

Реализовано без новой финансовой формулы: отдельно gross receipt и committed тариф
получающего counterparty (`baseFee`, `gasFee`, `liquidityFeeBps`), условие возможного
автосписания и переход к существующим Account collateral settings. Версия policy
сохраняется в test evidence и `data-policy-version`; продуктовый текст её не показывает.
Точный будущий fee/net не обещается: размер collateral request зависит от состояния
после получения. Отсутствующая policy явно не означает нулевую комиссию. Раскрытие
остаётся видимым после закрытия Spectrum. Его прежняя фраза `No fee is charged`
заменена точной: `This preparation submits no collateral request.` Сам выбор credit
и его подтверждение действительно не отправляют collateral request. Финансовое
поведение, policy и автоматические действия не менялись.

React Cross R12 проверил эти условия до manual Swap и повторил точную экономику R10:
1 pass, startup 18.419 с, browser 13.178 с, 0 page/MAC/auth errors.
Артефакт: `/tmp/xln-react-cross-swap-1788577815409/browser.log`.
Точные предшествующие Swap строки сохранены в `preSwapDisclosure`, включая
`Gross receive: 10198.98 USDT before fees.` и
`H1 collateral tariff: 0.1 USDT base + 0 USDT gas + 1 bps of the collateral requested.`
UI policy version 1 совпала с подписанным `request_collateral` в Account frame 6.
Его root: `0x3f8ca2e92ca4b041070da3922c8f250d7857d587df4dc4a3a83d7c2a04399391`.

Mobile 390×844: горизонтальное переполнение 0 px; скриншоты
`/tmp/xln-cross-receive-fees-mobile.png` и `/tmp/xln-cross-receive-fees-desktop.png`
получены после штатного исчезновения toast. После исполнения ссылка реально открыла
получающий Account, вкладку Collateral в Manage и USDT. Балансы, debt, permanent credit
и единственный cross-swap при переходе не изменились; сохранение draft при возврате
не проверено и не обещается.
Визуальная проверка R12 выявила отдельный mobile gap: существующий sticky Swap button
перекрывал нижнюю ссылку disclosure в исходной позиции прокрутки. Нулевое горизонтальное
переполнение этого не проверяло; переход по ссылке в R12 проверялся на desktop.

R11 выявил ошибку теста: whole-state equality после навигации требовала неизменности
roots/heights/collateral, пока уже отправленный J-rebalance продолжал финализироваться.
R12 сохраняет `after` и `afterSettings` целиком и проверяет экономические инварианты
перехода. Обе cross legs terminal `settled`; drain Account work проверен непосредственно
после исполнения. Более поздний `afterSettings.source.pending = true` показывает новое
состояние уже идущего J-rebalance, поэтому последний snapshot не является доказательством
полного J-drain. Этот браузерный прогон также не доказывает native TVM или общую release-готовность.

Последующая регрессия на том же кандидате runtime:

- Receive/Pay R13: обновлён явный выбор credit, затем отдельный `Extend credit limit`.
  Прежние проверки сохранены: 27.5 USDC limit preview, Move 25.000025, один batch,
  возврат к заполненному Pay без автоотправки. Startup 18.890 с + browser 10.599 с,
  1 pass. Артефакт: `/tmp/xln-react-capacity-1788578008372/browser.log`.
- Same-J + Cross R14: один bootstrap 18.761 с, два свежих wallet/context в одном
  последовательном browser run 19.338 с, 2 pass. Same-J списал 199.999992 USDC,
  получил 0.0799760016 WETH; permanent limit 0.0879824 WETH. Cross повторил точные
  gross/net/signed-fee проверки. Артефакт: `/tmp/xln-react-cross-swap-1788578133651/browser.log`.
- Root удалил только Swap из существующего mobile sticky selector. R14 проверяет
  геометрию: disclosure bottom 735.5625 px, Swap top 747.5625 px — зазор 12 px,
  горизонтальное переполнение 0. Свежий `/tmp/xln-cross-receive-fees-mobile.png`
  визуально подтверждает видимые текст и ссылку. Pay/Move/Spectrum sticky поведение
  этим исправлением не менялось. В обоих прогонах 0 page/MAC/auth errors.

## lending receive: первый production boundary

Incoming-путь Lending — payout при ручном закрытии своей открытой позиции без активных
заёмщиков; [LendingClose.tsx](../ui/src/components/LendingClose.tsx) уже использует общий
Spectrum. Borrow предоставляет исходящий credit и не перечисляет principal: показывать
для самого Borrow входящий Spectrum неверно.

Первый реальный React Lending R1 от 2026-09-05 остановился раньше закрытия:
свежий wallet получил 200 USDC через faucet; нажатие `Offer to the pool` для 200 USDC,
1 day, 100 bps вызвало runtime fail-stop `ACCOUNT_AUTHORITY_ENTITY_STAGE_APPLY_DISCARD_FAILED`.
Hub pool остался пустым. Startup 19.013 с, browser 22.158 с, exit 1; stand освобождён.
Артефакт: `/tmp/xln-react-lending-1788578675867/browser.log`; полная browser trace —
`/tmp/xln-react-lending-1788578675867/artifacts/e2e-lending-lending-close--e96ce-e-a-manual-committed-payout/trace.zip`.
Извлечённый console: `/tmp/xln-lending-r1-console.json`. В существующем логировании
нет вложенных `AggregateError.errors[]`, поэтому исходное исключение этим артефактом
не установлено. Runtime fix принадлежит отдельному TS owner; UI не обходит отказ.

TS owner затем воспроизвёл первичное исключение на реальном worker:
`ACCOUNT_TX_KIND_OUT_OF_PROFILE:lending_fund`; лог `/tmp/xln-lending-worker-boundary.log`.
Причина находится в каноническом admission profile, раньше исполнения Lending handler.
Повторять браузер или менять Spectrum до решения этого boundary не требуется;
разрешение transaction kinds должно сопровождаться проверкой готовности TS/Rust handlers.

[e2e-lending.spec.ts](../ui/tests/e2e-lending.spec.ts) готовит дальнейшую проверку только
через реальные UI-действия: lend 200, после исчезновения Account exposure изменить
свой grant на 1, получить реальный incoming deficit 199 при close, выбрать credit и
отдельно подтвердить постоянный grant 219.9 с +10% нового credit. Затем manual close,
terminal pool state и точный payout. Эти этапы **ещё не достигнуты и не доказаны**.
Раскрытие возможной auto-rebalance fee перед Lending close также остаётся следующим
проверяемым условием после исправления первого runtime boundary.
