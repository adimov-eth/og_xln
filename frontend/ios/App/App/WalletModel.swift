import Foundation
import SwiftUI
import WebKit
import Security
import LocalAuthentication

struct WalletToken: Decodable, Identifiable {
    let id: Int
    let symbol: String
    let name: String
    let amount: String
    let raw: String
    let available: String
}

struct WalletAccount: Decodable, Identifiable {
    let id: String
    let name: String
    let height: Int
    let root: String
    let pending: Bool
    let disputed: Bool
}

struct WalletRecipient: Decodable, Identifiable {
    let id: String
    let name: String
}

struct WalletMovement: Decodable, Identifiable {
    let id: String
    let title: String
    let state: String
    let tone: String
    let height: Int
    let amount: String
    let direction: String
    let detail: String
    let hash: String?
}

struct WalletSnapshot: Decodable {
    let name: String
    let entityId: String
    let height: Int
    let network: String
    let ready: Bool
    let tokens: [WalletToken]
    let accounts: [WalletAccount]
    let recipients: [WalletRecipient]
}

enum WalletKeychain {
    private static let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "finance.xln.wallet",
        kSecAttrAccount as String: "wallet-entropy"
    ]

    static func entropy() throws -> String {
        var read = query
        read[kSecReturnData as String] = true
        var item: CFTypeRef?
        let status = SecItemCopyMatching(read as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data {
            guard data.count == 16 else { throw failure("Wallet key has an invalid length.") }
            return "0x" + data.map { String(format: "%02x", $0) }.joined()
        }
        throw failure("Keychain read failed: \(status)")
    }

    static func hasWallet() throws -> Bool {
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecItemNotFound { return false }
        guard status == errSecSuccess else { throw failure("Keychain read failed: \(status)") }
        return true
    }

    static func failure(_ message: String) -> NSError {
        NSError(domain: "xln.wallet", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

@MainActor
final class WalletModel: ObservableObject {
    @Published var snapshot: WalletSnapshot?
    @Published var market: WalletMarketSnapshot?
    @Published var hostReady = false
    @Published var hasDeviceWallet = false
    @Published var openingBrainvault = false
    @Published var brainvaultCancellable = false
    @Published var busy = false {
        didSet { if !busy && lockRequested { Task { await lock() } } }
    }
    @Published var concealed = false
    @Published var progress = "Preparing your wallet"
    @Published var error: String?
    @Published var notice: String?
    weak var webView: WKWebView?
    private var lastEvidence = ""
    private var lockRequested = false
    private var unlocked = false
    private var runtimeGeneration = 0
    private let interruptedMessage = "Your wallet was interrupted. Reopen it to recover confirmed activity."

    init() {
        do { hasDeviceWallet = try WalletKeychain.hasWallet() }
        catch { self.error = error.localizedDescription }
    }

    func runtimeInterrupted() {
        // A dead JS session no longer authorizes financial UI. Keep an in-flight
        // command busy until WebKit rejects it; never replay its user intent.
        hostReady = false
        runtimeGeneration += 1
        unlocked = false
        snapshot = nil
        market = nil
        notice = nil
        lastEvidence = ""
        progress = "Open your wallet to recover confirmed activity."
        error = interruptedMessage
        print("XLN_RUNTIME_INTERRUPTED wallet_locked=true")
    }

    func receive(_ payload: [String: Any]) {
        switch payload["kind"] as? String {
        case "ready":
            hostReady = true
            progress = "Your keys. Your money."
            print("XLN_HOST_READY secure=\(payload["secure"] ?? false) crypto=\(payload["crypto"] ?? false) locks=\(payload["locks"] ?? false)")
        case "brainvaultProgress":
            guard let completed = payload["completed"] as? Int, let total = payload["total"] as? Int else { return }
            progress = "BrainVault · \(completed)/\(total)"
        case "brainvaultFinalizing":
            brainvaultCancellable = false
        case "brainvaultIdentity":
            #if DEBUG
            if let runtimeId = payload["runtimeId"] as? String { print("XLN_BRAINVAULT_IDENTITY \(runtimeId)") }
            #endif
        case "receipt":
            // A late bridge message must not repopulate a locked wallet's banner.
            // Durable receipts remain in Activity even when no wallet is visible.
            guard unlocked && !lockRequested && snapshot != nil else { return }
            notice = payload["message"] as? String
        case "progress": progress = payload["message"] as? String ?? progress
        case "error": error = payload["message"] as? String ?? "Runtime failed."
        case "market":
            guard unlocked && !lockRequested else { return }
            do {
                market = try JSONDecoder().decode(WalletMarketSnapshot.self, from: JSONSerialization.data(withJSONObject: payload))
            } catch { market = nil; self.error = "Cannot read market data: \(error.localizedDescription)" }
        case "snapshot":
            guard unlocked && !lockRequested else { return }
            do {
                let data = try JSONSerialization.data(withJSONObject: payload)
                snapshot = try JSONDecoder().decode(WalletSnapshot.self, from: data)
                #if DEBUG
                let evidence = try JSONSerialization.data(withJSONObject: ["entity": payload["entityId"] ?? "", "tokens": payload["tokens"] ?? [], "accounts": payload["accounts"] ?? [], "activity": payload["activity"] ?? []], options: [.sortedKeys])
                let encoded = String(decoding: evidence, as: UTF8.self)
                if encoded != lastEvidence { print("XLN_WALLET_EVIDENCE \(encoded)"); lastEvidence = encoded }
                #endif
            } catch { self.error = "Cannot read wallet state: \(error.localizedDescription)" }
        default: error = "Unknown message from wallet runtime."
        }
    }

    func call(_ command: [String: Any]) async throws -> Any? {
        guard hostReady, let webView else { throw WalletKeychain.failure("Wallet runtime is not ready.") }
        let generation = runtimeGeneration
        let result: Any?
        do {
            result = try await webView.callAsyncJavaScript(
                "try { return {kind: 'result', value: await window.xlnNative.run(command)}; } catch (error) { return {kind: 'error', message: String(error.message || error)}; }",
                arguments: ["command": command], in: nil, contentWorld: .page)
        } catch {
            throw generation == runtimeGeneration ? error : WalletKeychain.failure(interruptedMessage)
        }
        guard generation == runtimeGeneration else { throw WalletKeychain.failure(interruptedMessage) }
        guard let envelope = result as? [String: Any], let kind = envelope["kind"] as? String else {
            throw WalletKeychain.failure("Invalid response from wallet runtime.")
        }
        if kind == "error" { throw WalletKeychain.failure(envelope["message"] as? String ?? "Wallet command failed.") }
        guard kind == "result" else { throw WalletKeychain.failure("Unknown wallet response.") }
        return envelope["value"]
    }

    func unlock() async {
        guard !busy else { return }
        market = nil
        notice = nil
        busy = true
        error = nil
        defer { busy = false }
        do {
            let auth = LAContext()
            guard auth.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
                throw WalletKeychain.failure("Set an iPhone passcode to protect your wallet.")
            }
            guard try await auth.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: WalletL10n.text("Open your xln wallet")) else {
                throw WalletKeychain.failure("Wallet unlock was cancelled.")
            }
            guard !lockRequested else { return }
            unlocked = true
            _ = try await call(["type": "boot", "entropy": WalletKeychain.entropy()])
        } catch { unlocked = false; snapshot = nil; self.error = error.localizedDescription }
    }

    func openBrainvault(name: String, password: String, factor: Int, shards: Int?, creating: Bool = false, confirmation: String = "") async {
        guard !busy else { return }
        market = nil
        notice = nil
        busy = true; openingBrainvault = true; brainvaultCancellable = true; error = nil
        defer {
            openingBrainvault = false
            brainvaultCancellable = false
            if !unlocked { progress = "Your name and password recover your BrainVault." }
            busy = false
        }
        do {
            // Password authority comes from canonical BrainVault derivation, not Face ID.
            // Background locking still hides snapshots and never repeats financial commands.
            unlocked = true
            var command: [String: Any] = ["type": "brainvault", "name": name, "password": password, "factor": factor]
            if creating { command["intent"] = "create"; command["confirmation"] = confirmation; command["backupConsent"] = true }
            if let shards { command["shards"] = shards }
            _ = try await call(command)
        } catch { unlocked = false; snapshot = nil; self.error = error.localizedDescription == "BRAINVAULT_ABORTED" ? nil : error.localizedDescription }
    }

    func cancelBrainvault() async {
        guard openingBrainvault && brainvaultCancellable else { return }
        do {
            guard let result = try await call(["type": "cancelBrainvault"]) as? [String: Any],
                  let cancelled = result["cancelled"] as? Bool else {
                throw WalletKeychain.failure("Cannot read recovery cancellation status.")
            }
            // The JS boundary owns whether cancellation was still possible.
            // A late tap cannot undo an import already being persisted.
            if !cancelled { brainvaultCancellable = false }
        }
        catch { self.error = error.localizedDescription }
    }

    #if DEBUG
    func exportEvidence() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            guard let evidence = try await call(["type": "evidence"]) else { throw WalletKeychain.failure("Evidence unavailable.") }
            let data = try JSONSerialization.data(withJSONObject: evidence, options: [.sortedKeys])
            print("XLN_ACCEPTANCE_EVIDENCE \(String(decoding: data, as: UTF8.self))")
            notice = "Verification evidence exported"
        } catch { self.error = error.localizedDescription }
    }
    #endif

    func lock() async {
        lockRequested = true
        unlocked = false
        snapshot = nil
        market = nil
        notice = nil
        if openingBrainvault { await cancelBrainvault() }
        guard !busy else { return }
        busy = true
        defer { lockRequested = false; busy = false }
        do {
            _ = try await call(["type": "lock"])
            snapshot = nil
        } catch { self.error = error.localizedDescription }
    }
}
