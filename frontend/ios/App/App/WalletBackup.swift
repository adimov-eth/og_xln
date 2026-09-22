import SwiftUI

private struct WalletBackupReceipt: Decodable {
    let height: Int
    let checkpoint: String
    let bytes: Int
}

struct WalletBackup: View {
    @ObservedObject var model: WalletModel
    @Environment(\.dismiss) private var dismiss
    @State private var consent = false
    @State private var receipt: WalletBackupReceipt?
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Encrypted backup", systemImage: "lock.icloud").font(.title2.weight(.semibold))
                    Text("Create one encrypted copy of your confirmed wallet state. Your keys stay on this iPhone.")
                    Text("Manual backup. Create a new copy after payments or swaps.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Toggle("Allow sending an encrypted copy", isOn: $consent).disabled(model.busy)
                }
                Section {
                    Button("Create and verify backup") { Task { await run(upload: true) } }
                        .disabled(model.busy || !consent).accessibilityIdentifier("backup-create")
                    Button("Verify saved copy") { Task { await run(upload: false) } }
                        .disabled(model.busy).accessibilityIdentifier("backup-verify")
                }
                if model.busy { Section { HStack { ProgressView(); Text("Checking encrypted backup…") } } }
                if let receipt {
                    Section("Verified copy") {
                        Label("Downloaded and verified on this iPhone", systemImage: "checkmark.shield")
                            .foregroundStyle(.green)
                        LabeledContent("Snapshot height", value: String(receipt.height))
                        LabeledContent("Encrypted size", value: ByteCountFormatter.string(fromByteCount: Int64(receipt.bytes), countStyle: .file))
                    }
                }
                if let failure { Section { Text(WalletL10n.text(failure)).foregroundStyle(.red) } }
            }.navigationTitle("Backup").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(model.busy) } }
        }.interactiveDismissDisabled(model.busy)
    }

    private func run(upload: Bool) async {
        guard !model.busy else { return }
        model.busy = true; failure = nil; receipt = nil
        defer { model.busy = false }
        do {
            guard let result = try await model.call(["type": upload ? "backup" : "verifyBackup", "consent": consent]) else {
                throw WalletKeychain.failure("The recovery service did not confirm storage.")
            }
            receipt = try JSONDecoder().decode(WalletBackupReceipt.self, from: JSONSerialization.data(withJSONObject: result))
            #if DEBUG
            if let receipt { print("XLN_BACKUP_VERIFIED height=\(receipt.height) checkpoint=\(receipt.checkpoint) bytes=\(receipt.bytes)") }
            #endif
        } catch { failure = error.localizedDescription }
    }
}
