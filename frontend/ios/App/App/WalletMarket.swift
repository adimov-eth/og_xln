import SwiftUI

struct WalletMarketSnapshot: Decodable {
    struct Level: Decodable, Identifiable {
        let id: String
        let price: String
        let amount: String
        let own: Bool
    }
    let hubId: String
    let hubName: String
    let base: String
    let quote: String
    let status: String
    let updatedAt: Double
    let error: String?
    let bids: [Level]
    let asks: [Level]
    let spread: String?

    func isFresh(_ now: Date) -> Bool {
        status == "live" && now.timeIntervalSince1970 * 1000 - updatedAt < 30_000
    }
}

struct WalletOrderDraft: Identifiable {
    let id = UUID()
    let side: String
    let price: String
    let hubId: String
}

struct WalletMarket: View {
    @ObservedObject var model: WalletModel
    @State private var draft: WalletOrderDraft?
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                ScrollView {
                    if let market = model.market {
                        VStack(alignment: .leading, spacing: 24) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("\(market.base) / \(market.quote)").font(.largeTitle.weight(.semibold))
                                HStack {
                                    Text(market.hubName)
                                    Spacer()
                                    Label(LocalizedStringKey(market.isFresh(context.date) ? "Live market" : "Updating market…"),
                                          systemImage: market.isFresh(context.date) ? "dot.radiowaves.left.and.right" : "clock")
                                        .foregroundStyle(market.isFresh(context.date) ? .green : .secondary)
                                }.font(.subheadline)
                            }
                            if let error = market.error { Text(WalletL10n.text(error)).font(.footnote).foregroundStyle(.red) }
                            Text("Choose a price, then enter your amount. You review the final terms before placing an order.")
                                .font(.subheadline).foregroundStyle(.secondary)
                            AnyLayout(typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 20)) : AnyLayout(HStackLayout(alignment: .top, spacing: 12))) {
                                levels(market.bids, title: "Bids", side: "sell", market: market, now: context.date)
                                levels(market.asks, title: "Asks", side: "buy", market: market, now: context.date)
                            }
                            if let spread = market.spread {
                                LabeledContent("Spread", value: "\(WalletL10n.amount(spread)) \(market.quote)")
                                    .font(.footnote).foregroundStyle(.secondary)
                            }
                            Text("Prices in USDC · amounts in WETH. A limit order may remain open or fill in parts.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }.padding(24)
                    } else {
                        ContentUnavailableView("Waiting for the market", systemImage: "chart.bar.xaxis",
                            description: Text("Connect to xln to see live bids and asks."))
                    }
                }.background(WalletStyle.background)
            }
            .navigationTitle("Market").navigationBarTitleDisplayMode(.inline)
        }
        .sheet(item: $draft) { selected in
            if let wallet = model.snapshot {
                WalletActionSheet(model: model, wallet: wallet, action: "Swap", order: selected)
            }
        }
    }

    private func levels(_ rows: [WalletMarketSnapshot.Level], title: String, side: String, market: WalletMarketSnapshot, now: Date) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(LocalizedStringKey(title)).font(.headline)
            Text(LocalizedStringKey(side == "buy" ? "Tap to buy WETH" : "Tap to sell WETH"))
                .font(.caption).foregroundStyle(.secondary)
            if rows.isEmpty { Text("No orders").font(.subheadline).foregroundStyle(.secondary) }
            ForEach(rows) { level in
                Button {
                    draft = WalletOrderDraft(side: side, price: level.price, hubId: market.hubId)
                } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(WalletL10n.amount(level.price)).font(.headline).foregroundStyle(side == "buy" ? .orange : .green)
                        Text(WalletL10n.amount(level.amount)).font(.caption).foregroundStyle(.secondary)
                        if level.own { Text("Includes your order").font(.caption2).foregroundStyle(.secondary) }
                    }.monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                        .background(WalletStyle.surface, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain)
                    .disabled(!market.isFresh(now) || model.busy || model.snapshot?.ready != true)
                    .accessibilityIdentifier("market-\(side)-\(level.id)")
                    .accessibilityLabel(Text(LocalizedStringKey(side == "buy" ? "Buy WETH" : "Sell WETH")) + Text(" · \(WalletL10n.amount(level.price)) USDC · \(WalletL10n.amount(level.amount)) WETH"))
            }
        }.frame(maxWidth: .infinity, alignment: .topLeading)
    }
}
