# xln: комиссии против top-20 cex

Проверено: **2026-09-05**. Исследование опубликованных тарифов; без входа в аккаунты,
торговли и получения персональных котировок. Тариф XLN — **предложение владельца**,
а не подтверждённая комиссия действующего production-продукта.

## Вывод

**«XLN за 3 bp минимум вдвое дешевле каждой биржи top-20» — неверно.**
Bitfinex публикует стандартные **0 / 0 bp**, MEXC — **0 / 5 bp**.
У MEXC преимущество XLN перед taker fee только **1.67×**, перед maker fee его нет.
[Bitfinex fees](https://www.bitfinex.com/fees/),
[MEXC spot FAQ](https://www.mexc.com/support/article/beginner-s-guide-to-spot-trading-faq-332253318490269696).

- В таблице **12 сопоставимых опубликованных базовых тарифов**: **10/12** дают преимущество
  XLN ≥2× по обычной spot-комиссии; **2/12** — нет. Это невзвешенное сравнение бирж,
  а не доля рынка или сделок. Для остальных **8/20** глобальный текущий тариф не подтверждён.
- На всей исходной двадцатке доказано **10 «да», 2 «нет», 8 «неизвестно»**. Не превращать
  10/12 в обещание о всех двадцати, всех парах или всех пользователях.
- **1 bp за платёж** нельзя сравнивать с CEX-комиссией за обмен: это разные услуги.
  Внутренние переводы цифровых активов между пользователями Bitfinex, например, бесплатны.
  [Bitfinex, internal transfers](https://www.bitfinex.com/fees/).
- Ни одна строка не доказывает преимущество **полной стоимости исполнения**: отдельно
  остаются spread, slippage, комиссии маршрута/хаба, gas, funding/lease, ввод и вывод.

## Выборка и метод

Источник состава: [CoinMarketCap, Top Cryptocurrency Spot Exchanges](https://coinmarketcap.com/rankings/exchanges/).
Первые 20 позиций подтверждены полями `name` и `rank` в опубликованных данных страницы.
Это рейтинг CMC по собственной комбинации ликвидности, трафика, объёмов и доверия к объёмам;
не утверждение, что это двадцать лучших или самых безопасных компаний. Региональные
Binance TR и Tokocrypto оставлены в выборке: не заменяем неудобные строки другими биржами.

Сравниваем одно исполнение одного пользователя, базовую ступень без VIP, купонов и оплаты
нативным токеном; maker и taker не складываются. Для XLN предполагаем **однократные 3 bp
от исполненного экономического notional**, без повторного начисления на каждый hop или
обе ноги. Правило начисления необходимо закрепить до реализации.

`1 bp = 0.01%`. Условие «минимум вдвое» — CEX fee **≥6 bp** при XLN fee **3 bp**.
Стандартные бесплатные тарифы не исключаем как «промо». Специальные пары и условные скидки
показываем отдельно. Числа — прочитанные публичные тарифы, не гарантия тарифа конкретного
аккаунта. Старые официальные объявления помечены; неполный HTML не считаем нулевой ставкой.

## Все 20 позиций

| CMC | Биржа / сопоставляемый рынок                  | Maker, bp | Taker, bp | Taker / XLN 3 bp      | Доказательство / ограничение                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------- | --------: | --------: | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Binance, standard Spot                        |        10 |        10 | **3.33×**             | [Текущая таблица Regular User](https://www.binance.com/en/fee/trading); без BNB. USDC taker указан отдельно: 9.5 bp.                                                                                                                                                                                                                                                                                                                             |
| 2   | Coinbase Exchange, обычные пары, $0–10k / 30d |        40 |        60 | **20×**               | [Exchange fees](https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees). Не Coinbase retail Buy и не все stablepairs.                                                                                                                                                                                                                                                                                                           |
| 3   | Upbit Korea                                   |         ? |         ? | **Не засчитано**      | [Fee page](https://www.upbit.com/service_center/fees) не вернула числовую таблицу. [Официальный toolkit](https://docs.upbit.com/kr/kr/docs/upbit-strategy-toolkit-reference) использует 5 bp KRW и 25 bp BTC/USDT, но это параметры бэктеста; текущий исполняемый тариф этим не доказываем.                                                                                                                                                      |
| 4   | OKX global, обычные группы 1–3                |         8 |        10 | **3.33×**             | [Global fee framework](https://www.okx.com/help/updates-to-global-fee-framework), Regular User. Региональная EEA-сетка и zero-fee пары отличаются.                                                                                                                                                                                                                                                                                               |
| 5   | Bybit, crypto/crypto Spot, VIP 0              |        10 |        10 | **3.33×**             | [Fee structure](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure), обновлено 2026-09-02. Fiat/Adventure Zone — отдельные ставки; регион может изменить тариф.                                                                                                                                                                                                                                                                  |
| 6   | Bitget, standard Spot                         |        10 |        10 | **3.33×**             | [Trading Fees FAQ](https://www.bitget.com/support/articles/12560603892734), 2026-08-20; без BGB/VIP/promotions.                                                                                                                                                                                                                                                                                                                                  |
| 7   | Gate global                                   |         ? |         ? | **Не засчитано**      | [Global fee page](https://www.gate.com/fee) вернула заголовки без чисел. [Gate EU](https://www.gate.com/en-eu/fee) подтверждает 10/10 bp, но региональный тариф не подменяет global.                                                                                                                                                                                                                                                             |
| 8   | KuCoin, VIP 0, Class A                        |        10 |        10 | **3.33×**             | [VIP Fee Structure](https://www.kucoin.com/support/48142946141635). Class B: 20/20; Class C: 30/30 bp. Без KCS.                                                                                                                                                                                                                                                                                                                                  |
| 9   | MEXC, обычный Spot                            |         0 |         5 | **1.67× — нет**       | [Официальный Spot FAQ](https://www.mexc.com/support/article/beginner-s-guide-to-spot-trading-faq-332253318490269696). [Fee overview](https://www.mexc.com/fee) предупреждает о региональных/парных исключениях.                                                                                                                                                                                                                                  |
| 10  | HTX                                           |         ? |         ? | **Не засчитано**      | [Fee settings](https://www.htx.com/en-in/fee) не отдала числовую таблицу без входа. Исторические 20 bp не считаем проверенным текущим default.                                                                                                                                                                                                                                                                                                   |
| 11  | Crypto.com Exchange                           |         ? |         ? | **Не засчитано**      | [Fees & limits](https://crypto.com/exchange/document/fees-limits): поисковый индекс показывает Level 1 без CRO 25/50 bp и дату 2026-07-09; прямое чтение таблицу не вернуло. Нужен повторный readback.                                                                                                                                                                                                                                           |
| 12  | Bitfinex, Spot                                |     **0** |     **0** | **Нет: CEX fee ниже** | [Fee schedule](https://www.bitfinex.com/fees/) и [Zero Fees Q&A](https://blog.bitfinex.com/products/zero-fees-qa/): стандарт с 2025-12-17, без объёма/LEO/tier; не краткая акция.                                                                                                                                                                                                                                                                |
| 13  | BingX, standard Spot                          |         ? |         ? | **Не засчитано**      | [Официальное объявление о 0.1%](https://bingx.com/ru-ru/support/articles/21835987551897-SpotTradingFeesWillBeAdjustedto0.1%25/) и [Academy](https://bingx.com/nl-nl/learn/crypto-trading-bingx-fees/). Источники 2023 года сообщали 10/10 bp; текущая fee page не раскрыла ставки. Исторический тариф исключён из подтверждённого сравнения.                                                                                                     |
| 14  | Kraken Pro, Spot Crypto, $0+ / 30d            |        25 |        40 | **13.33×**            | [Fee schedule](https://www.kraken.com/features/fee-schedule). Stablecoin/FX и Instant Buy — другие продукты.                                                                                                                                                                                                                                                                                                                                     |
| 15  | Binance TR                                    |         ? |         ? | **Не засчитано**      | [Fee schedule](https://www.binance.tr/en/fees/): TRY и crypto tiers существуют, но чтение вернуло «No records founds». Не наследуем автоматически Binance global.                                                                                                                                                                                                                                                                                |
| 16  | LBank, опубликованный base Spot               |        10 |        10 | **3.33×**             | [Официальная Academy](https://www.lbank.com/academy/lbank-pay-fees-hidden). [Fee page](https://www.lbank.com/fee) переадресует на personal rate; отдельные пары могут стоить дороже.                                                                                                                                                                                                                                                             |
| 17  | Bitstamp by Robinhood                         |         ? |         ? | **Не засчитано**      | [Fee schedule](https://www.bitstamp.net/fee-schedule/) не отдала содержимое. Не подставляем исторические 30/40 bp.                                                                                                                                                                                                                                                                                                                               |
| 18  | Bithumb, KRW, без купона                      |        25 |        25 | **8.33×**             | [Coupon FAQ](https://support.bithumb.com/hc/ko/articles/51131586657689-%EC%88%98%EC%88%98%EB%A3%8C-0-04-%EC%BF%A0%ED%8F%B0%EC%9D%B4-%EB%AC%B4%EC%97%87%EC%9D%B8%EA%B0%80%EC%9A%94) и [обычная market-order fee](https://support.bithumb.com/hc/ko/articles/55133079159449-%EC%88%98%EC%88%98%EB%A3%8C%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%EC%A0%81%EC%9A%A9%EB%90%98%EB%82%98%EC%9A%94): 25 bp base; 4 bp после регистрации купона на 30 дней. |
| 19  | XT.COM                                        |         ? |         ? | **Не засчитано**      | [Fee page](https://www.xt.com/en/rate) показала шапку без числовых tiers.                                                                                                                                                                                                                                                                                                                                                                        |
| 20  | Tokocrypto, USDT/crypto Spot                  |        15 |        15 | **5×**                | [Изменение с 2026-06-18](https://support.tokocrypto.com/hc/en-us/articles/46562860238477-Transaction-Fee-Adjustment-in-Relation-to-Exchange-Migration). Только trading fee; налог и ICEx fee отдельно. IDR maker/taker: 10/20 bp.                                                                                                                                                                                                                |

## Исключения, которые меняют коммерческий вывод

- **Stable/stable — отдельный рынок.** OKX публикует 0/0 bp для DAI-USDT,
  PYUSD-USDT, USDC-USDT, USDG-USDT и USDT-USD. Поэтому 3 bp для обычного ETH/USDT swap
  и 3 bp для USDC/USDT имеют разную конкурентоспособность.
  [OKX zero-fee pairs](https://www.okx.com/help/updates-to-global-fee-framework).
- Coinbase eligible stablepairs: **0 maker / 0.45 bp taker** для пользователей вне
  Liquidity Program. Но **USDT-USDC и USDT-USD исключены** из этого режима с 2025-05-01.
  Нельзя переносить stablepair fee на все stablecoins.
  [Coinbase stablepair fees](https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees).
- Bithumb с 4 bp купоном даёт только **1.33×**, не 2×; BTC market на публичной help-page
  обозначен бесплатным. Это отдельные условия, не базовая KRW-строка.
  [Bithumb fees](https://support.bithumb.com/hc/ko/articles/51131554420377-%EA%B1%B0%EB%9E%98-%EC%88%98%EC%88%98%EB%A3%8C%EB%8A%94-%EC%96%BC%EB%A7%88%EC%9D%B8%EA%B0%80%EC%9A%94).
- VIP/market-maker сделки могут иметь нулевую или отрицательную maker fee.
  Например, OKX global VIP 7+ содержит maker rebates; нельзя обещать профессиональному
  MM розничное преимущество 3.33×.
  [OKX fee tiers](https://www.okx.com/help/updates-to-global-fee-framework).

## Как позиционировать и что измерить

Рабочая формулировка: **«Планируем 0.03% платформенной комиссии за исполненный swap;
это ниже опубликованных базовых spot-комиссий многих крупных CEX. Полная цена — в quote».**
До production-доказательства использовать «планируем». «Самые дешёвые» и «вдвое дешевле
всех top-20» не использовать.

Для $10,000 notional: XLN platform fee **$3**; CEX при 10 bp — **$10**.
Запас **$7** легко поглощается худшим spread, routing или funding. Для преимуществ
**вдвое по полной стоимости** недостаточно того, что одна строка комиссии ниже.

Следующий минимальный сравнительный артефакт: одновременно снятые исполнимые quotes
для **ETH/USDT, USDC/USDT и USDT между Ethereum/Tron** на **$100 / $1,000 / $10,000**.
Фиксировать исходный/конечный актив, конкретную сеть, регион/tier, количество на выходе,
все комиссии и время доступности средств. Сравнивать два отдельных сценария:
средства уже внутри системы; полный цикл от внешнего кошелька до внешнего кошелька.

Это сравнительное исследование и pricing hypothesis. Оно не подтверждает прибыльность
1/3 bp, качество исполнения XLN или завершение launch-gates. Проверка `bun run check`
остаётся обязанностью интегратора перед заявлением о готовности рабочего дерева.
