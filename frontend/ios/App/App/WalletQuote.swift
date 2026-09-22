import Foundation

struct WalletRouteOption: Decodable, Identifiable {
    let id: String
    let name: String
    let fee: String
}

struct WalletTicket: Decodable {
    let id: String
    let expiresAt: Double
    let title: String
    let give: String
    let receive: String
    let fee: String
    let destination: String
    let note: String
    let needsCapacity: Bool
    let price: String?
    let routePath: String?
    let routes: [WalletRouteOption]?

    // Display the runtime's actual deadline; Swift never issues or extends a quote.
    // The runtime still consumes and validates the authorization on every confirm.
    func isExpired(at now: Date) -> Bool {
        now.timeIntervalSince1970 * 1000 > expiresAt
    }
}
