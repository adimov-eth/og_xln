# xln: fees vs top-20 cex

Verified: **2026-09-05**. Research of published fee schedules; without logging into accounts,
trading, or obtaining personalized quotes. The XLN tariff is **the owner's proposal**,
not a confirmed fee of a live production product.

## Conclusion

**"XLN at 3 bp is at least twice as cheap as every top-20 exchange" — false.**
Bitfinex publishes a standard **0 / 0 bp**, MEXC — **0 / 5 bp**.
Against MEXC, XLN's advantage over the taker fee is only **1.67×**, and there is none over the maker fee.
[Bitfinex fees](https://www.bitfinex.com/fees/),
[MEXC spot FAQ](https://www.mexc.com/support/article/beginner-s-guide-to-spot-trading-faq-332253318490269696).

- In the table there are **12 comparable published base tariffs**: **10/12** give XLN an
  advantage of ≥2× on the regular spot fee; **2/12** do not. This is an unweighted comparison of exchanges,
  not a share of market or trades. For the remaining **8/20** the current global tariff is not confirmed.
- Across the full original twenty, **10 "yes", 2 "no", 8 "unknown"** are proven. Do not turn
  10/12 into a promise about all twenty, all pairs, or all users.
- **1 bp per payment** cannot be compared to a CEX exchange fee: these are different services.
  Internal transfers of digital assets between Bitfinex users, for example, are free.
  [Bitfinex, internal transfers](https://www.bitfinex.com/fees/).
- No line proves an advantage in **total cost of execution**: spread, slippage,
  route/hub fees, gas, funding/lease, deposit, and withdrawal remain separate.

## Sample and method

Source of the composition: [CoinMarketCap, Top Cryptocurrency Spot Exchanges](https://coinmarketcap.com/rankings/exchanges/).
The first 20 positions are confirmed by the `name` and `rank` fields in the page's published data.
This is CMC's ranking based on its own combination of liquidity, traffic, volumes, and confidence in volumes;
not a claim that these are the twenty best or safest companies. The regional
Binance TR and Tokocrypto are left in the sample: we do not replace inconvenient rows with other exchanges.

We compare a single execution by a single user, the base tier without VIP, coupons, or payment
in the native token; maker and taker are not added together. For XLN we assume **a single 3 bp charge
on the executed economic notional**, without re-charging on each hop or
both legs. The charging rule must be locked down before implementation.

`1 bp = 0.01%`. The "at least twice" condition means a CEX fee **≥6 bp** against an XLN fee of **3 bp**.
We do not exclude standard free tariffs as "promo". Special pairs and conditional discounts
are shown separately. The numbers are publicly read tariffs, not a guarantee of a specific
account's tariff. Old official announcements are marked; incomplete HTML is not counted as a zero rate.

## All 20 positions

| CMC | Exchange / comparable market                  | Maker, bp | Taker, bp | Taker / XLN 3 bp      | Evidence / limitation                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------- | --------: | --------: | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Binance, standard Spot                        |        10 |        10 | **3.33×**             | [Current Regular User table](https://www.binance.com/en/fee/trading); without BNB. USDC taker is listed separately: 9.5 bp.                                                                                                                                                                                                                                                                                                                      |
| 2   | Coinbase Exchange, regular pairs, $0–10k / 30d |        40 |        60 | **20×**               | [Exchange fees](https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees). Not Coinbase retail Buy, and not all stablepairs.                                                                                                                                                                                                                                                                                                      |
| 3   | Upbit Korea                                   |         ? |         ? | **Not counted**       | [Fee page](https://www.upbit.com/service_center/fees) did not return a numeric table. The [official toolkit](https://docs.upbit.com/kr/kr/docs/upbit-strategy-toolkit-reference) uses 5 bp KRW and 25 bp BTC/USDT, but these are backtest parameters; this does not prove the current executable tariff.                                                                                                                                      |
| 4   | OKX global, regular groups 1–3                |         8 |        10 | **3.33×**             | [Global fee framework](https://www.okx.com/help/updates-to-global-fee-framework), Regular User. The regional EEA grid and zero-fee pairs differ.                                                                                                                                                                                                                                                                                                 |
| 5   | Bybit, crypto/crypto Spot, VIP 0              |        10 |        10 | **3.33×**             | [Fee structure](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure), updated 2026-09-02. Fiat/Adventure Zone are separate rates; region may change the tariff.                                                                                                                                                                                                                                                                   |
| 6   | Bitget, standard Spot                         |        10 |        10 | **3.33×**             | [Trading Fees FAQ](https://www.bitget.com/support/articles/12560603892734), 2026-08-20; without BGB/VIP/promotions.                                                                                                                                                                                                                                                                                                                              |
| 7   | Gate global                                   |         ? |         ? | **Not counted**       | [Global fee page](https://www.gate.com/fee) returned headers without numbers. [Gate EU](https://www.gate.com/en-eu/fee) confirms 10/10 bp, but a regional tariff does not substitute for global.                                                                                                                                                                                                                                                |
| 8   | KuCoin, VIP 0, Class A                        |        10 |        10 | **3.33×**             | [VIP Fee Structure](https://www.kucoin.com/support/48142946141635). Class B: 20/20; Class C: 30/30 bp. Without KCS.                                                                                                                                                                                                                                                                                                                              |
| 9   | MEXC, regular Spot                            |         0 |         5 | **1.67× — no**        | [Official Spot FAQ](https://www.mexc.com/support/article/beginner-s-guide-to-spot-trading-faq-332253318490269696). [Fee overview](https://www.mexc.com/fee) warns of regional/pair exceptions.                                                                                                                                                                                                                                                  |
| 10  | HTX                                           |         ? |         ? | **Not counted**       | [Fee settings](https://www.htx.com/en-in/fee) did not return a numeric table without logging in. Historical 20 bp is not counted as a verified current default.                                                                                                                                                                                                                                                                                 |
| 11  | Crypto.com Exchange                           |         ? |         ? | **Not counted**       | [Fees & limits](https://crypto.com/exchange/document/fees-limits): the search index shows Level 1 without CRO 25/50 bp and a date of 2026-07-09; a direct read did not return the table. A repeat readback is needed.                                                                                                                                                                                                                           |
| 12  | Bitfinex, Spot                                |     **0** |     **0** | **No: CEX fee is lower** | [Fee schedule](https://www.bitfinex.com/fees/) and [Zero Fees Q&A](https://blog.bitfinex.com/products/zero-fees-qa/): standard since 2025-12-17, without volume/LEO/tier; not a brief promotion.                                                                                                                                                                                                                                                |
| 13  | BingX, standard Spot                          |         ? |         ? | **Not counted**       | [Official announcement of 0.1%](https://bingx.com/ru-ru/support/articles/21835987551897-SpotTradingFeesWillBeAdjustedto0.1%25/) and [Academy](https://bingx.com/nl-nl/learn/crypto-trading-bingx-fees/). 2023 sources reported 10/10 bp; the current fee page did not disclose rates. The historical tariff is excluded from the confirmed comparison.                                                                                        |
| 14  | Kraken Pro, Spot Crypto, $0+ / 30d            |        25 |        40 | **13.33×**            | [Fee schedule](https://www.kraken.com/features/fee-schedule). Stablecoin/FX and Instant Buy are other products.                                                                                                                                                                                                                                                                                                                                  |
| 15  | Binance TR                                    |         ? |         ? | **Not counted**       | [Fee schedule](https://www.binance.tr/en/fees/): TRY and crypto tiers exist, but the read returned "No records founds". We do not automatically inherit Binance global.                                                                                                                                                                                                                                                                         |
| 16  | LBank, published base Spot                    |        10 |        10 | **3.33×**             | [Official Academy](https://www.lbank.com/academy/lbank-pay-fees-hidden). [Fee page](https://www.lbank.com/fee) redirects to personal rate; individual pairs may cost more.                                                                                                                                                                                                                                                                      |
| 17  | Bitstamp by Robinhood                         |         ? |         ? | **Not counted**       | [Fee schedule](https://www.bitstamp.net/fee-schedule/) did not return content. We do not substitute historical 30/40 bp.                                                                                                                                                                                                                                                                                                                         |
| 18  | Bithumb, KRW, without coupon                  |        25 |        25 | **8.33×**             | [Coupon FAQ](https://support.bithumb.com/hc/ko/articles/51131586657689-%EC%88%98%EC%88%98%EB%A3%8C-0-04-%EC%BF%A0%ED%8F%B0%EC%9D%B4-%EB%AC%B4%EC%97%87%EC%9D%B8%EA%B0%80%EC%9A%94) and the [regular market-order fee](https://support.bithumb.com/hc/ko/articles/55133079159449-%EC%88%98%EC%88%98%EB%A3%8C%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%EC%A0%81%EC%9A%A9%EB%90%98%EB%82%98%EC%9A%94): 25 bp base; 4 bp after registering a coupon for 30 days. |
| 19  | XT.COM                                        |         ? |         ? | **Not counted**       | [Fee page](https://www.xt.com/en/rate) showed a header without numeric tiers.                                                                                                                                                                                                                                                                                                                                                                     |
| 20  | Tokocrypto, USDT/crypto Spot                  |        15 |        15 | **5×**                | [Change effective 2026-06-18](https://support.tokocrypto.com/hc/en-us/articles/46562860238477-Transaction-Fee-Adjustment-in-Relation-to-Exchange-Migration). Trading fee only; tax and ICEx fee are separate. IDR maker/taker: 10/20 bp.                                                                                                                                                                                                        |

## Exceptions that change the commercial conclusion

- **Stable/stable is a separate market.** OKX publishes 0/0 bp for DAI-USDT,
  PYUSD-USDT, USDC-USDT, USDG-USDT, and USDT-USD. Therefore 3 bp for a regular ETH/USDT swap
  and 3 bp for USDC/USDT have different competitiveness.
  [OKX zero-fee pairs](https://www.okx.com/help/updates-to-global-fee-framework).
- Coinbase eligible stablepairs: **0 maker / 0.45 bp taker** for users outside the
  Liquidity Program. But **USDT-USDC and USDT-USD are excluded** from this regime since 2025-05-01.
  The stablepair fee cannot be carried over to all stablecoins.
  [Coinbase stablepair fees](https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees).
- Bithumb with a 4 bp coupon gives only **1.33×**, not 2×; the BTC market on the public help page
  is marked as free. These are separate conditions, not the base KRW row.
  [Bithumb fees](https://support.bithumb.com/hc/ko/articles/51131554420377-%EA%B1%B0%EB%9E%98-%EC%88%98%EC%88%98%EB%A3%8C%EB%8A%94-%EC%96%BC%EB%A7%88%EC%9D%B8%EA%B0%80%EC%9A%94).
- VIP/market-maker trades can have a zero or negative maker fee.
  For example, OKX global VIP 7+ includes maker rebates; a professional
  MM cannot be promised the retail advantage of 3.33×.
  [OKX fee tiers](https://www.okx.com/help/updates-to-global-fee-framework).

## How to position it and what to measure

Working phrasing: **"We plan a 0.03% platform fee per executed swap;
this is below the published base spot fees of many major CEXs. The full price is in the quote."**
Until production proof, use "we plan". Do not use "the cheapest" or "twice as cheap
as all of top-20".

For a $10,000 notional: XLN platform fee is **$3**; CEX at 10 bp is **$10**.
The **$7** margin is easily absorbed by a worse spread, routing, or funding. For a
**twice as cheap on total cost** advantage, it is not enough that one fee line is lower.

The next minimal comparative artifact: simultaneously captured executable quotes
for **ETH/USDT, USDC/USDT, and USDT between Ethereum/Tron** at **$100 / $1,000 / $10,000**.
Record the source/destination asset, the specific network, region/tier, the output amount,
all fees, and the time until funds are available. Compare two separate scenarios:
funds already inside the system; the full cycle from external wallet to external wallet.

This is a comparative study and pricing hypothesis. It does not confirm the profitability
of 1/3 bp, the execution quality of XLN, or the completion of launch-gates. The `bun run check`
check remains the integrator's responsibility before declaring the working tree ready.
