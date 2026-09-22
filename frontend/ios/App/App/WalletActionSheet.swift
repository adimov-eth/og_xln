import SwiftUI
import CoreImage.CIFilterBuiltins

private struct WalletSubmittedOrder {
    let id: String
    let account: WalletAccount
}

struct WalletActionSheet: View {
    @ObservedObject var model: WalletModel
    let wallet: WalletSnapshot
    let action: String
    var order: WalletOrderDraft? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var price = ""
    @State private var recipient = ""
    @State private var token = 1
    @State private var ticket: WalletTicket?
    @State private var testCredit = false
    @State private var failure: String?
    @State private var result: String?
    @State private var submittedOrder: WalletSubmittedOrder?
    @State private var showingOrder = false
    @State private var showingScanner = false
    @State private var paymentRequest: WalletPaymentRequest?

    var body: some View {
        NavigationStack {
            Form {
                if let result {
                    Section { Label(WalletL10n.text(result), systemImage: action == "Test money" ? "checkmark.circle" : "clock").foregroundStyle(action == "Test money" ? .green : .secondary).padding(.vertical, 12) }
                    if let submittedOrder {
                        Section {
                            Text(submittedOrder.id).font(.caption.monospaced()).textSelection(.enabled)
                            Button("View order result") { showingOrder = true }
                        }
                    }
                    Section { Text("Activity shows confirmed payments and completed swap fills.").foregroundStyle(.secondary) }
                } else if action == "Receive" {
                    Section { WalletAddressQR(address: wallet.entityId).frame(maxWidth: .infinity).padding(.vertical, 16); Text("Your xln address").font(.headline); Text(wallet.entityId).font(.body.monospaced()).textSelection(.enabled) }
                    Section { ShareLink(item: wallet.entityId) { Label("Share address", systemImage: "square.and.arrow.up") } }
                } else if let ticket {
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Maximum payment").foregroundStyle(.secondary).accessibilityIdentifier("review-maximum")
                            Text(WalletL10n.amount(ticket.give)).font(.largeTitle.weight(.semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.5)
                        }.padding(.vertical, 14)
                        WalletAmountRow(title: action == "Swap" ? "Minimum received" : "They receive", value: ticket.receive)
                        WalletAmountRow(title: "Maximum fee", value: ticket.fee)
                        if let price = ticket.price { WalletAmountRow(title: "Limit price · per WETH", value: price) }
                    }
                    Section("To") { Text(ticket.destination).font(.footnote.monospaced()).textSelection(.enabled); Text(WalletL10n.text(ticket.note)).font(.footnote).foregroundStyle(.secondary) }
                    if let routes = ticket.routes, !routes.isEmpty {
                        Section {
                            DisclosureGroup {
                            ForEach(routes) { route in
                                Button { Task { await quote(routePath: route.id) } } label: {
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text(route.name).foregroundStyle(.primary)
                                            Text(WalletL10n.amount(route.fee)).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if route.id == ticket.routePath { Image(systemName: "checkmark.circle.fill") }
                                    }
                                }.disabled(model.busy).accessibilityIdentifier("payment-route-\(route.name)")
                            }
                            } label: {
                                LabeledContent("Payment route", value: routes.first(where: { $0.id == ticket.routePath })?.name ?? WalletL10n.text("Automatic"))
                            }
                        }
                    }
                    if ticket.needsCapacity {
                        Section("Incoming capacity") {
                            Text("Your hub needs capacity to deliver this asset. Test credit allows the hub to owe you tokens without collateral.")
                            Toggle("Allow unsecured test credit", isOn: $testCredit)
                            Button("Prepare receiving capacity") { Task { await quote(prepare: true) } }.disabled(!testCredit || model.busy)
                        }
                    } else {
                        Section {
                            TimelineView(.periodic(from: .now, by: 1)) { context in
                                if ticket.isExpired(at: context.date) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        Text("Quote expired. Review a fresh quote before continuing.")
                                            .font(.footnote).foregroundStyle(.secondary)
                                        Button { Task { await quote(routePath: ticket.routePath) } } label: {
                                            actionLabel("Refresh quote")
                                        }.disabled(model.busy).accessibilityIdentifier("refresh-quote")
                                    }
                                } else {
                                    Button { Task { await confirm(ticket) } } label: { actionLabel("Confirm \(action.lowercased())") }
                                        .disabled(model.busy).accessibilityIdentifier("confirm-operation")
                                }
                            }
                        }
                    }
                    Button("Edit details") { self.ticket = nil }.disabled(model.busy)
                } else if action == "Test money" {
                    Section {
                        Text("100 USDC").font(.largeTitle.weight(.semibold))
                        Text("Test money · no real value").foregroundStyle(.secondary)
                        Text("This action can increase the amount your hub owes you without collateral.")
                        Toggle("Allow unsecured test credit", isOn: $testCredit)
                    }
                    Section { Button { Task { await faucet() } } label: { actionLabel("Get 100 test USDC") }.disabled(!testCredit || model.busy).accessibilityIdentifier("get-test-money") }
                } else {
                    if let order {
                        Section(LocalizedStringKey(order.side == "buy" ? "Buy WETH" : "Sell WETH")) {
                            TextField("Amount · WETH", text: $amount).keyboardType(.decimalPad).font(.title2).accessibilityIdentifier("operation-amount")
                        }
                        Section("Limit price · USDC per WETH") {
                            TextField("Price", text: $price).keyboardType(.decimalPad).font(.title2).accessibilityIdentifier("order-price")
                        }
                    } else {
                    Section("You pay") {
                        HStack(spacing: 12) {
                            if action == "Send" {
                                ForEach(wallet.tokens) { asset in assetButton(asset.symbol, id: asset.id) }
                            } else {
                            assetButton("USDC", id: 1)
                            assetButton("WETH", id: 2)
                            }
                        }
                        .disabled(paymentRequest?.tokenLocked == true)
                        TextField("0.00", text: $amount).keyboardType(.decimalPad).font(.largeTitle).accessibilityIdentifier("operation-amount")
                            .disabled(paymentRequest?.amount.isEmpty == false)
                    }
                    }
                    if action == "Send" {
                        Section("Recipient") {
                            if let paymentRequest {
                                Text(paymentRequest.recipient).font(.footnote.monospaced()).textSelection(.enabled)
                                if !paymentRequest.description.isEmpty { Text(paymentRequest.description).font(.footnote) }
                                Button("Clear payment request") { self.paymentRequest = nil; recipient = ""; amount = "" }
                            } else {
                                TextField("xln address or payment link", text: $recipient).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("operation-recipient")
                                ForEach(wallet.recipients) { person in Button { recipient = person.id } label: { HStack { Text(person.name); Spacer(); if recipient == person.id { Image(systemName: "checkmark") } } } }
                                if !recipient.isEmpty { Button("Read payment request") { Task { await readRequest(recipient) } }.disabled(model.busy) }
                            }
                            Button("Scan QR code", systemImage: "qrcode.viewfinder") { showingScanner = true }
                                .disabled(model.busy).accessibilityIdentifier("scan-payment")
                        }
                    } else { Section { LabeledContent("Receive", value: token == 1 ? "WETH" : "USDC"); Text(LocalizedStringKey(order == nil ? "A live price with fees shown before you confirm." : "Your limit sets the price. The order may remain open or fill in parts.")).foregroundStyle(.secondary) } }
                    Section { Button { Task { await quote() } } label: { actionLabel("Review \(action.lowercased())") }.disabled(amount.isEmpty || model.busy || (order != nil && price.isEmpty) || (action == "Send" && recipient.isEmpty)).accessibilityIdentifier("review-operation") }
                }
                if model.busy { Section { HStack { ProgressView(); Text(WalletL10n.text(model.progress)) } } }
                if let failure { Section { Text(WalletL10n.text(failure)).foregroundStyle(.red).textSelection(.enabled) } }
            // A fresh authorization starts at its amounts, never at the old form's Confirm position.
            }.id(ticket?.id)
                .navigationTitle(LocalizedStringKey(ticket?.title ?? action)).navigationBarTitleDisplayMode(.inline)
                .onAppear { if let order { price = WalletL10n.amount(order.price); token = order.side == "buy" ? 1 : 2 } }
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(LocalizedStringKey(result == nil ? "Close" : "Done")) { dismiss() }.disabled(model.busy) } }
                .interactiveDismissDisabled(model.busy)
                .sheet(isPresented: $showingScanner) {
                    WalletScanner { raw in Task { await readRequest(raw) } }
                }
                .navigationDestination(isPresented: $showingOrder) {
                    if let submittedOrder { WalletOrders(model: model, account: submittedOrder.account, offerId: submittedOrder.id) }
                }
        }.tint(WalletStyle.accent)
    }

    private func actionLabel(_ title: String) -> some View {
        Text(LocalizedStringKey(title)).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 10)
    }
    private func assetButton(_ symbol: String, id: Int) -> some View {
        Button { token = id; failure = nil } label: {
            HStack {
                Text(symbol).font(.headline)
                if token == id { Image(systemName: "checkmark").font(.caption.weight(.bold)) }
            }.frame(maxWidth: .infinity).padding(.vertical, 12)
                .foregroundStyle(token == id ? WalletStyle.accent : .secondary)
        }.buttonStyle(.plain)
            .glassEffect(.regular.tint(token == id ? WalletStyle.accent.opacity(0.12) : .clear).interactive())
            .accessibilityLabel(symbol).accessibilityAddTraits(token == id ? .isSelected : [])
            .accessibilityIdentifier("asset-\(symbol)")
    }
    private func run(_ command: [String: Any]) async -> Any? {
        guard !model.busy else { return nil }
        model.busy = true; failure = nil; model.progress = "Checking your wallet…"
        defer { model.busy = false }
        do { return try await model.call(command) }
        catch { failure = error.localizedDescription; return nil }
    }
    private func quote(prepare: Bool = false, routePath: String? = nil) async {
        var command: [String: Any] = ["type": action == "Swap" ? "quoteSwap" : "quotePayment", "amount": amount, "token": token, "recipient": recipient, "prepare": prepare, "testCredit": testCredit, "decimalSeparator": Locale.current.decimalSeparator ?? "."]
        if let order { command["type"] = "quoteOrder"; command["price"] = price; command["side"] = order.side; command["hubId"] = order.hubId }
        if let routePath { command["routePath"] = routePath }
        if let paymentRequest { command["paymentRequest"] = paymentRequest.raw }
        ticket = nil
        let value = await run(command)
        guard let value else { return }
        do { ticket = try JSONDecoder().decode(WalletTicket.self, from: JSONSerialization.data(withJSONObject: value)) }
        catch { failure = "Cannot read the quote: \(error.localizedDescription)" }
    }
    private func readRequest(_ raw: String) async {
        ticket = nil
        // Invalidate the previous draft before parsing a replacement QR.
        paymentRequest = nil; recipient = ""; amount = ""
        guard let value = await run(["type": "readPaymentRequest", "paymentRequest": raw,
                                    "token": token, "decimalSeparator": Locale.current.decimalSeparator ?? "."]) else { return }
        do {
            let request = try JSONDecoder().decode(WalletPaymentRequest.self, from: JSONSerialization.data(withJSONObject: value))
            paymentRequest = request; recipient = request.recipient; token = request.token; amount = request.amount
        } catch { failure = error.localizedDescription }
    }
    private func confirm(_ ticket: WalletTicket) async {
        guard let value = await run(["type": "confirm", "id": ticket.id]) as? [String: Any] else { return }
        result = value["message"] as? String
        if let offerId = value["offerId"] as? String, let accountId = value["accountId"] as? String {
            guard let account = wallet.accounts.first(where: { $0.id == accountId }) else {
                failure = "The order account is unavailable. Check Activity."; return
            }
            submittedOrder = WalletSubmittedOrder(id: offerId, account: account)
        }
    }
    private func faucet() async {
        if let value = await run(["type": "faucet", "testCredit": testCredit, "decimalSeparator": Locale.current.decimalSeparator ?? "."]) as? [String: Any] { result = value["message"] as? String }
    }
}

struct WalletAddressQR: View {
    let address: String
    private static let context = CIContext()
    private var image: UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(address.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
              let image = Self.context.createCGImage(output.transformed(by: CGAffineTransform(scaleX: 6, y: 6)), from: output.extent.applying(CGAffineTransform(scaleX: 6, y: 6))) else { return nil }
        return UIImage(cgImage: image)
    }
    var body: some View {
        if let image {
            Image(uiImage: image).interpolation(.none).resizable().scaledToFit().frame(width: 220, height: 220)
                .padding(16).background(.white, in: RoundedRectangle(cornerRadius: 20))
                .accessibilityLabel("QR code for your xln address")
        } else { Label("QR code unavailable. Share the address below.", systemImage: "qrcode") }
    }
}
