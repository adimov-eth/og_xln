import Foundation

@main
struct QuoteExpiryChecks {
    static func main() throws {
        // Decoder vectors, not a fake wallet/runtime. Milliseconds from the bridge
        // must stay milliseconds, and older bundles without a deadline must fail.
        let json = #"{"id":"quote-vector","expiresAt":2000000,"title":"Review payment","give":"0.000000000000000001 WETH","receive":"0.000000000000000001 WETH","fee":"0 WETH","destination":"recipient","note":"","needsCapacity":false}"#
        let ticket = try JSONDecoder().decode(WalletTicket.self, from: Data(json.utf8))
        precondition(!ticket.isExpired(at: Date(timeIntervalSince1970: 1999)))
        precondition(!ticket.isExpired(at: Date(timeIntervalSince1970: 2000)))
        precondition(ticket.isExpired(at: Date(timeIntervalSince1970: 2000.001)))
        precondition(ticket.give == "0.000000000000000001 WETH")
        let missingDeadline = json.replacingOccurrences(of: #""expiresAt":2000000,"#, with: "")
        do {
            _ = try JSONDecoder().decode(WalletTicket.self, from: Data(missingDeadline.utf8))
            preconditionFailure("QUOTE_WITHOUT_DEADLINE_ACCEPTED")
        } catch DecodingError.keyNotFound(let key, _) {
            precondition(key.stringValue == "expiresAt")
        }
        print("Quote expiry: 5/5 assertions passed (before, exact boundary, after, exact amount, missing deadline rejected)")
    }
}
