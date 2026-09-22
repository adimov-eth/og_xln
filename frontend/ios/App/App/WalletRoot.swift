import SwiftUI

enum WalletStyle {
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.84, green: 0.67, blue: 0.40, alpha: 1)
            : UIColor(red: 0.31, green: 0.275, blue: 0.898, alpha: 1)
    })
    static let background = Color(uiColor: .systemGroupedBackground)
    static let surface = Color(uiColor: .secondarySystemGroupedBackground)
    static let secondaryText = Color.primary.opacity(0.72)
}

struct WalletRoot: View {
    @ObservedObject var model: WalletModel
    @State private var showingBrainvault = false
    @State private var creatingBrainvault = false
    @ScaledMetric(relativeTo: .largeTitle) private var welcomeSize = 46.0

    var body: some View {
        Group {
            if let snapshot = model.snapshot {
                TabView {
                    Tab("Home", systemImage: "house") { WalletHome(model: model, wallet: snapshot) }
                    Tab("Market", systemImage: "chart.bar.xaxis") { WalletMarket(model: model) }
                    Tab("Activity", systemImage: "clock") { WalletActivity(model: model) }
                    Tab("Manage", systemImage: "square.stack.3d.up") { WalletConnections(wallet: snapshot) }
                    Tab("Settings", systemImage: "slider.horizontal.3") { WalletSettings(model: model, wallet: snapshot) }
                }
            } else { welcome }
        }
        .background(WalletStyle.background.ignoresSafeArea())
        .tint(WalletStyle.accent)
        .overlay {
            if model.concealed {
                ZStack { WalletStyle.background.ignoresSafeArea(); Image(systemName: "lock.shield").font(.largeTitle).foregroundStyle(WalletStyle.accent) }
                    .accessibilityLabel("Wallet locked")
            }
        }
        .alert("Wallet needs attention", isPresented: Binding(get: { model.error != nil && !showingBrainvault }, set: { if !$0 { model.error = nil } })) {
            Button("OK", role: .cancel) { model.error = nil }
        } message: { Text(WalletL10n.text(model.error ?? "")) }
    }

    private var welcome: some View {
        GeometryReader { geometry in
        ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Image(systemName: "arrow.up.right").font(.system(size: 54, weight: .light))
                .foregroundStyle(WalletStyle.accent).padding(26).glassEffect(in: .rect(cornerRadius: 30))
                .accessibilityHidden(true)
            Text("Money,\nwithout borders.").font(.system(size: welcomeSize, weight: .semibold, design: .rounded)).tracking(-2)
                .accessibilityIdentifier("welcome-title")
            Text("A wallet that belongs to you.\nSend, receive and exchange with xln.")
                .font(.title3).foregroundStyle(WalletStyle.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Text(WalletL10n.text(model.progress)).font(.subheadline).foregroundStyle(.primary)
                .accessibilityIdentifier("wallet-progress")
            Button("Create BrainVault", systemImage: "plus") { creatingBrainvault = true; showingBrainvault = true }
                .buttonStyle(.glassProminent).controlSize(.large)
                .disabled(!model.hostReady || model.busy).accessibilityIdentifier("brainvault-create")
            Button("Open BrainVault", systemImage: "key") { creatingBrainvault = false; showingBrainvault = true }
                .buttonStyle(.glass).controlSize(.large)
                .disabled(!model.hostReady || model.busy).accessibilityIdentifier("brainvault-open")
            if model.hasDeviceWallet {
            Button { Task { await model.unlock() } } label: {
                HStack { if model.busy { ProgressView() }; Text(LocalizedStringKey(model.busy ? "Opening wallet…" : "Open saved device wallet")); Spacer(); Image(systemName: "arrow.right") }
                    .font(.headline).padding(.vertical, 12)
            }.buttonStyle(.glass).controlSize(.large)
                .disabled(!model.hostReady || model.busy).accessibilityIdentifier("wallet-open")
            }
            Text("Your name and password recover your BrainVault.").font(.footnote).foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }.padding(28).padding(.bottom, 20).frame(maxWidth: .infinity, alignment: .leading).background(WalletStyle.background).frame(minHeight: geometry.size.height)
        }
        }
        .sheet(isPresented: $showingBrainvault) { WalletBrainvault(model: model, creating: creatingBrainvault) }
    }

}

struct WalletConnections: View {
    let wallet: WalletSnapshot
    var body: some View {
        NavigationStack {
            List {
                Section("Connections") {
                    ForEach(wallet.accounts) { account in
                        DisclosureGroup {
                            LabeledContent("Confirmed frame", value: String(account.height))
                            Text(account.id).font(.caption.monospaced()).textSelection(.enabled)
                            Text(account.root).font(.caption.monospaced()).textSelection(.enabled)
                        } label: {
                            HStack { Text(account.name); Spacer(); Text(LocalizedStringKey(account.disputed ? "Disputed" : account.pending ? "Confirming" : "Connected")).foregroundStyle(.secondary).font(.caption) }
                        }
                    }
                }
            }.navigationTitle("Manage")
        }
    }


}

struct WalletHome: View {
    @ObservedObject var model: WalletModel
    let wallet: WalletSnapshot
    @State private var selectedAction: String?
    @State private var selectedToken = 1
    @ScaledMetric(relativeTo: .largeTitle) private var balanceSize = 56.0
    @Environment(\.dynamicTypeSize) private var typeSize
    private var balanceToken: WalletToken? {
        wallet.tokens.first(where: { $0.id == selectedToken }) ?? wallet.tokens.first
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 10) {
                        if let asset = balanceToken {
                            Button { selectedAction = "Balance asset" } label: {
                                Label(asset.symbol, systemImage: "chevron.down").frame(minHeight: 44)
                            }
                                .accessibilityLabel("Balance asset").accessibilityValue(asset.symbol).accessibilityIdentifier("balance-asset")
                        } else { Text("Balance").font(.subheadline).foregroundStyle(.secondary) }
                        Text(WalletL10n.amount(balanceToken?.amount ?? "0")).font(.system(size: balanceSize, weight: .medium, design: .rounded))
                            .tracking(-2).monospacedDigit().minimumScaleFactor(0.5).lineLimit(1).accessibilityIdentifier("wallet-balance")
                        if let asset = balanceToken {
                            Label {
                                Text("Payment capacity") + Text(": \(WalletL10n.amount(asset.available)) \(asset.symbol)")
                            } icon: { Image(systemName: "bolt.fill") }
                                .font(.subheadline).foregroundStyle(.secondary)
                            Text("Capacity includes available credit.").font(.caption2).foregroundStyle(.secondary)
                        }
                    }.padding(.top, 22)
                    GlassEffectContainer(spacing: 12) {
                        AnyLayout(typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))) {
                            actionButton("Send", "arrow.up.right")
                            actionButton("Receive", "arrow.down.left")
                            actionButton("Swap", "arrow.left.arrow.right")
                        }
                    }
                    Button { selectedAction = "Market" } label: {
                        HStack {
                            Image(systemName: "chart.bar.xaxis").foregroundStyle(WalletStyle.accent)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("WETH / USDC").font(.headline)
                                Text("Order book and limit orders").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                        }.padding(20).background(WalletStyle.surface, in: RoundedRectangle(cornerRadius: 24))
                    }.buttonStyle(.plain).accessibilityIdentifier("wallet-market")
                    if let notice = model.notice {
                        Label(WalletL10n.text(notice), systemImage: "checkmark.seal").font(.subheadline).foregroundStyle(.green)
                    }
                    VStack(alignment: .leading, spacing: 18) {
                        Text("ASSETS").font(.caption.weight(.semibold)).tracking(2).foregroundStyle(.secondary)
                        if wallet.tokens.isEmpty { Text("Your wallet is ready. Add funds to get started.").foregroundStyle(.secondary) }
                        ForEach(wallet.tokens) { token in
                            AnyLayout(typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10)) : AnyLayout(HStackLayout(spacing: 14))) {
                                Text(token.symbol == "USDC" ? "$" : token.symbol == "WETH" ? "Ξ" : String(token.symbol.prefix(1))).font(.title3.weight(.semibold)).frame(width: 46, height: 46)
                                    .foregroundStyle(WalletStyle.accent).background(WalletStyle.accent.opacity(0.12), in: Circle())
                                VStack(alignment: .leading, spacing: 4) { Text(token.symbol).font(.headline); Text(token.name).font(.caption).foregroundStyle(.secondary) }
                                Spacer()
                                Text(WalletL10n.amount(token.amount)).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6).accessibilityIdentifier("token-\(token.symbol)")
                            }.padding(.vertical, 6)
                        }
                    }
                    Button { selectedAction = "Test money" } label: {
                        HStack { VStack(alignment: .leading, spacing: 5) { Text("Try it with test money").font(.headline); Text("100 USDC · no real value").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "plus") }
                        .padding(20).background(WalletStyle.surface, in: RoundedRectangle(cornerRadius: 24))
                    }.buttonStyle(.plain).disabled(!wallet.ready || model.busy)
                    VStack(alignment: .leading, spacing: 14) {
                        Text("CONNECTED TO XLN").font(.caption.weight(.semibold)).tracking(2).foregroundStyle(.secondary)
                        ForEach(wallet.accounts) { account in
                            Button { selectedAction = "Manage" } label: {
                                HStack { Image(systemName: "network").foregroundStyle(WalletStyle.accent); Text(account.name); Spacer(); Image(systemName: account.pending ? "clock" : "checkmark.circle.fill").foregroundStyle(account.pending ? .orange : .green); Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary) }
                            }.buttonStyle(.plain).accessibilityLabel(Text("Connections") + Text(" · \(account.name)"))
                        }
                    }.padding(20).background(WalletStyle.surface, in: RoundedRectangle(cornerRadius: 24))
                    HStack {
                        Button("View activity") { selectedAction = "Activity" }
                        Spacer()
                        Button("Wallet settings") { selectedAction = "Settings" }
                    }.font(.subheadline).buttonStyle(.plain).padding(.vertical, 10)
                }.padding(.horizontal, 24).padding(.bottom, 32)
            }.background(WalletStyle.background)
                .navigationTitle("xln").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { Button { selectedAction = "Settings" } label: { Image(systemName: "person.crop.circle") }.accessibilityLabel("Wallet settings") }
                    ToolbarItem(placement: .topBarTrailing) { Image(systemName: wallet.ready ? "checkmark.shield" : "arrow.trianglehead.2.clockwise.rotate.90").foregroundStyle(wallet.ready ? .green : .secondary) }
                }
        }.sheet(isPresented: Binding(get: { selectedAction != nil }, set: { if !$0 { selectedAction = nil } })) {
            if let action = selectedAction {
                if action == "Activity" { WalletActivity(model: model) }
                else if action == "Balance asset" { assetPicker }
                else if action == "Market" { WalletMarket(model: model) }
                else if action == "Manage" { WalletConnections(wallet: model.snapshot ?? wallet) }
                else if action == "Settings" { WalletSettings(model: model, wallet: model.snapshot ?? wallet) }
                else { WalletActionSheet(model: model, wallet: model.snapshot ?? wallet, action: action) }
            }
        }
    }
    private var assetPicker: some View {
        NavigationStack {
            List(wallet.tokens) { token in
                Button { selectedToken = token.id; selectedAction = nil } label: {
                    HStack {
                        Text(token.symbol).font(.headline)
                        Spacer()
                        Text(WalletL10n.amount(token.amount)).monospacedDigit()
                        if token.id == balanceToken?.id { Image(systemName: "checkmark") }
                    }.foregroundStyle(.primary).frame(minHeight: 44).contentShape(Rectangle())
                }.accessibilityIdentifier("balance-choice-\(token.symbol)")
            }.navigationTitle("Balance asset").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { selectedAction = nil } } }
        }.presentationDetents([.medium, .large])
    }
    private func actionButton(_ title: String, _ symbol: String) -> some View {
        Button { selectedAction = title } label: {
            AnyLayout(typeSize.isAccessibilitySize ? AnyLayout(HStackLayout(spacing: 14)) : AnyLayout(VStackLayout(spacing: 9))) { Image(systemName: symbol).font(.title3.weight(.medium)); Text(LocalizedStringKey(title)).font(.subheadline.weight(.semibold)) }
                .frame(maxWidth: .infinity).padding(.vertical, 16)
        }.buttonStyle(.plain).glassEffect(.regular.interactive(), in: .rect(cornerRadius: 24))
            .disabled(!wallet.ready || model.busy).accessibilityIdentifier("wallet-\(title.lowercased())")
    }
}


struct WalletSettings: View {
    @ObservedObject var model: WalletModel
    let wallet: WalletSnapshot
    @State private var showingBackup = false
    var body: some View {
        NavigationStack {
            List {
                Section("Wallet") {
                    LabeledContent("Network", value: wallet.network)
                    LabeledContent("Confirmed frame", value: String(wallet.height))
                    ShareLink(item: wallet.entityId) { Label("Share wallet address", systemImage: "square.and.arrow.up") }
                }
                Section("Security") {
                    Label("Keys stored on this iPhone", systemImage: "key")
                    Button("Encrypted backup") { showingBackup = true }.disabled(model.busy)
                    Button("Lock wallet", role: .destructive) { Task { await model.lock() } }.disabled(model.busy)
                }
                Section { Text("xln · native for iPhone").foregroundStyle(.secondary) }
                #if DEBUG
                Section("Verification") {
                    Button("Export test evidence") { Task { await model.exportEvidence() } }.disabled(model.busy)
                }
                #endif
            }.navigationTitle("Settings")
                .sheet(isPresented: $showingBackup) { WalletBackup(model: model) }
        }
    }
}
