import SwiftUI

struct WalletAmountRow: View {
    let title: String
    let value: String

    var body: some View {
        LabeledContent {
            // Keep every digit together at large text sizes. Only presentation
            // scales; the exact runtime amount and spoken value are unchanged.
            Text(WalletL10n.amount(value)).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.5)
        } label: {
            Text(LocalizedStringKey(title))
        }
        .accessibilityRepresentation {
            LabeledContent(LocalizedStringKey(title), value: WalletL10n.amount(value))
        }
    }
}

private struct WalletHistoryPage: Decodable {
    enum Availability: String, Decodable { case complete, partial }
    let availability: Availability
    let items: [WalletMovement]
    let nextBeforeHeight: Int?
}

struct WalletActivity: View {
    @ObservedObject var model: WalletModel
    @State private var page: WalletHistoryPage?
    @State private var cursors: [Int?] = [nil]
    @State private var loading = false
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            List {
                if let wallet = model.snapshot {
                    Section("Swaps") {
                        ForEach(wallet.accounts) { account in
                            NavigationLink(account.name) { WalletOrders(model: model, account: account) }
                        }
                    }
                }
                if let failure {
                    Text(WalletL10n.text(failure)).foregroundStyle(.red)
                    Button("Try again") { Task { await load() } }
                }
                if let page {
                    if page.availability == .partial {
                        Section {
                            Label("Earlier history unavailable", systemImage: "clock.badge.exclamationmark")
                                .accessibilityIdentifier("history-incomplete")
                            Text("This device does not have all past payment records.")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    ForEach(page.items) { item in
                        DisclosureGroup {
                            Text(WalletL10n.text(item.detail)).font(.subheadline)
                            LabeledContent("Confirmed frame", value: String(item.height))
                            if let hash = item.hash { Text(hash).font(.caption.monospaced()).textSelection(.enabled) }
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: item.direction == "in" ? "arrow.down.left" : "arrow.up.right")
                                    .font(.title3).frame(width: 36, height: 36)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(WalletL10n.text(item.title))
                                    Text(WalletL10n.text(item.state)).font(.caption).foregroundStyle(item.tone == "failed" ? .red : .secondary)
                                }
                                Spacer()
                                Text(WalletL10n.amount(item.amount)).font(.subheadline).monospacedDigit()
                            }.padding(.vertical, 6)
                        }
                    }
                    if page.items.isEmpty && page.availability == .complete { Text("No activity on this page.").foregroundStyle(.secondary) }
                    if cursors.count > 1 {
                        Button("Newer records") { cursors.removeLast(); Task { await load() } }.disabled(loading)
                    }
                    if let next = page.nextBeforeHeight {
                        Button("Earlier records") { cursors.append(next); Task { await load() } }.disabled(loading)
                    }
                }
                if loading { ProgressView().frame(maxWidth: .infinity) }
            }.navigationTitle("Activity")
                .refreshable { cursors = [nil]; await load() }
                .task { if page == nil { await load() } }
        }
    }

    private func load() async {
        guard !loading else { return }
        loading = true
        failure = nil
        defer { loading = false }
        do {
            let cursor: Any = (cursors.last ?? nil).map { $0 as Any } ?? NSNull()
            guard let result = try await model.call(["type": "history", "beforeHeight": cursor]) else {
                throw WalletKeychain.failure("History is unavailable.")
            }
            page = try JSONDecoder().decode(WalletHistoryPage.self, from: JSONSerialization.data(withJSONObject: result))
        } catch { failure = error.localizedDescription }
    }
}

private struct WalletOrderPage: Decodable {
    struct Order: Decodable, Identifiable {
        struct Fill: Decodable, Identifiable {
            let id: String
            let height: Int
            let gave: String
            let received: String
            let fee: String
            let comment: String
        }
        let id: String
        let pair: String
        let state: String
        let requested: String
        let fills: [Fill]
    }
    let items: [Order]
    let nextCursor: String?
}

struct WalletOrders: View {
    @ObservedObject var model: WalletModel
    let account: WalletAccount
    var offerId: String? = nil
    @State private var page: WalletOrderPage?
    @State private var cursors: [String?] = [nil]
    @State private var loading = false
    @State private var failure: String?

    var body: some View {
        List {
            if let failure { Text(WalletL10n.text(failure)).foregroundStyle(.red); Button("Try again") { Task { await load() } } }
            if let page {
                ForEach(page.items.filter { offerId == nil || $0.id == offerId }) { order in
                    Section {
                        LabeledContent("Status", value: WalletL10n.text(order.state))
                        LabeledContent("Requested", value: WalletL10n.amount(order.requested))
                        ForEach(order.fills) { fill in
                            VStack(alignment: .leading, spacing: 8) {
                                WalletAmountRow(title: "Gave", value: fill.gave)
                                WalletAmountRow(title: "Received before fee", value: fill.received)
                                WalletAmountRow(title: "Fee", value: fill.fee)
                                if !fill.comment.isEmpty { Text(WalletL10n.text(fill.comment)).font(.caption).foregroundStyle(.secondary) }
                                LabeledContent("Confirmed frame", value: String(fill.height)).font(.caption)
                            }.padding(.vertical, 8)
                        }
                        if order.fills.isEmpty { Text("No execution recorded.").foregroundStyle(.secondary) }
                        Text(order.id).font(.caption.monospaced()).textSelection(.enabled)
                    } header: { Text(order.pair) }
                }
                if let offerId, !page.items.contains(where: { $0.id == offerId }) {
                    Text("The order is not in these confirmed records yet.").foregroundStyle(.secondary)
                    Text(offerId).font(.caption.monospaced()).textSelection(.enabled)
                } else if page.items.isEmpty { Text("No orders on this account.").foregroundStyle(.secondary) }
                Button("Refresh order status") { cursors = [nil]; Task { await load() } }.disabled(loading)
                if cursors.count > 1 { Button("Newer records") { cursors.removeLast(); Task { await load() } }.disabled(loading) }
                if let cursor = page.nextCursor { Button("Earlier records") { cursors.append(cursor); Task { await load() } }.disabled(loading) }
            }
            if loading { ProgressView() }
        }.navigationTitle(LocalizedStringKey(offerId == nil ? "Swaps" : "Order status")).task { if page == nil { await load() } }
            .refreshable { cursors = [nil]; await load() }
    }

    private func load() async {
        guard !loading else { return }
        loading = true; failure = nil
        defer { loading = false }
        do {
            let cursor: Any = (cursors.last ?? nil).map { $0 as Any } ?? NSNull()
            guard let result = try await model.call(["type": "orders", "accountId": account.id, "cursor": cursor]) else {
                throw WalletKeychain.failure("History is unavailable.")
            }
            page = try JSONDecoder().decode(WalletOrderPage.self, from: JSONSerialization.data(withJSONObject: result))
        } catch { failure = error.localizedDescription }
    }
}
