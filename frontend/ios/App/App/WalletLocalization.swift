import Foundation

enum WalletL10n {
    // Only presentation separators change; token quantities never pass through Double.
    static func amount(_ value: String) -> String {
        if !value.contains(where: { $0.isNumber }) { return text(value) }
        let pieces = value.components(separatedBy: ".")
        return pieces.map { $0.replacingOccurrences(of: ",", with: Locale.current.groupingSeparator ?? ",") }
            .joined(separator: Locale.current.decimalSeparator ?? ".")
    }

    static func text(_ key: String) -> String {
        if key.hasPrefix("RECOVERY_BACKUP_TOO_LARGE:") {
            let values = key.split(separator: ":").dropFirst().compactMap { Int64($0.split(separator: "=").last ?? "") }
            if values.count == 2 {
                let size = ByteCountFormatter.string(fromByteCount: values[0], countStyle: .file)
                let limit = ByteCountFormatter.string(fromByteCount: values[1], countStyle: .file)
                return String(format: text("Encrypted copy: %@. Service limit: %@. No copy was uploaded."), size, limit)
            }
        }
        let recoveryPrefix = "No verified backup could be restored."
        for prefix in ["The recovery service is unavailable. Try again shortly.",
                       "The backup could not be verified. No recovery data was applied."] where key.hasPrefix(prefix) {
            let detail = key.dropFirst(prefix.count).trimmingCharacters(in: .whitespacesAndNewlines)
            return Bundle.main.localizedString(forKey: prefix, value: nil, table: nil) + (detail.isEmpty ? "" : "\n" + detail)
        }
        if key.hasPrefix(recoveryPrefix) {
            let detail = key.dropFirst(recoveryPrefix.count).trimmingCharacters(in: .whitespacesAndNewlines)
            return text("No verified account backup was found. Check your BrainVault name, password and work settings.") + (detail.isEmpty ? "" : "\n" + detail)
        }
        if key.hasPrefix("below-minTradeSize:") { return text("Amount is below the market minimum.") }
        if key.hasPrefix("Payment confirmed · frame ") {
            return text("Payment confirmed")
        }
        for prefix in ["Syncing with the chain", "Joining", "Opening an account with"] where key.hasPrefix(prefix) {
            return Bundle.main.localizedString(forKey: prefix, value: nil, table: nil) + key.dropFirst(prefix.count)
        }
        return Bundle.main.localizedString(forKey: key, value: nil, table: nil)
    }
}
