import Foundation

@main
struct ReceiptSessionChecks {
    @MainActor
    static func main() async {
        var failures: [String] = []
        func check(_ condition: Bool, _ name: String) {
            if !condition { failures.append(name) }
        }
        // Exercise the real model at locked/failed-open boundaries. These are UI
        // message vectors; no WebView, wallet, network, key or receipt is mocked.
        let message: [String: Any] = ["kind": "receipt", "message": "receipt session test vector"]
        let model = WalletModel()
        model.receive(message)
        check(model.notice == nil, "locked model accepted receipt")
        model.notice = "previous session notice"
        await model.lock()
        check(model.notice == nil, "lock retained previous notice")
        model.receive(message)
        check(model.notice == nil, "late receipt repopulated locked model")

        let busyModel = WalletModel()
        busyModel.busy = true
        busyModel.notice = "previous session notice"
        await busyModel.lock()
        check(busyModel.notice == nil, "deferred lock retained notice")

        let failedOpen = WalletModel()
        failedOpen.notice = "previous session notice"
        await failedOpen.openBrainvault(name: "session-test", password: "not-a-wallet-secret", factor: 1, shards: nil)
        check(failedOpen.notice == nil && failedOpen.error != nil, "failed open retained notice")
        print("Receipt session: \(5 - failures.count)/5 assertions passed")
        for failure in failures { print("FAIL: \(failure)") }
        if !failures.isEmpty { exit(1) }
    }
}
