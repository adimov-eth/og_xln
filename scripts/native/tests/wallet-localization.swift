import Foundation

@main
struct WalletLocalizationChecks {
    static func main() {
        let prefixes = [
            "The recovery service is unavailable. Try again shortly.",
            "The backup could not be verified. No recovery data was applied."
        ]
        for prefix in prefixes {
            // Exact keys must terminate as well as messages with diagnostics.
            precondition(WalletL10n.text(prefix) == prefix)
            precondition(WalletL10n.text(prefix + " HTTP_503") == prefix + "\nHTTP_503")
        }
        precondition(WalletL10n.text("No verified backup could be restored.") ==
            "No verified account backup was found. Check your BrainVault name, password and work settings.")
        print("WalletLocalization: 5/5 assertions passed")
    }
}
