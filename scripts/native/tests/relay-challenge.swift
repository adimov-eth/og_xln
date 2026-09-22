import Foundation

// Same URLSession transport as NativeSockets, without a browser Origin header.
// Read only: no wallet, signing material or financial command is involved.
@main
struct RelayChallenge {
    static func main() async throws {
        guard CommandLine.arguments.count == 2,
              let url = URL(string: CommandLine.arguments[1]) else {
            throw NSError(domain: "RELAY_TEST_URL_REQUIRED", code: 1)
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 5
        configuration.timeoutIntervalForResource = 10
        let session = URLSession(configuration: configuration)
        let socket = session.webSocketTask(with: url)
        defer {
            socket.cancel(with: .normalClosure, reason: nil)
            session.invalidateAndCancel()
        }
        socket.resume()
        let message = try await socket.receive()
        let data: Data
        switch message {
        case .data(let value): data = value
        case .string(let value): data = Data(value.utf8)
        @unknown default: throw NSError(domain: "RELAY_TEST_MESSAGE_INVALID", code: 1)
        }
        print(data.base64EncodedString())
    }
}
