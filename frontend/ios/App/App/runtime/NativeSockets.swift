import Foundation
import WebKit

/// Transport only. Runtime hello signatures, session encryption and ACKs remain in JS.
final class NativeSockets: NSObject, URLSessionWebSocketDelegate {
    weak var webView: WKWebView?
    var origin: URL!
    private var tasks: [String: URLSessionWebSocketTask] = [:]
    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)

    func handle(_ packet: [String: Any]) {
        guard let id = packet["id"] as? String, let action = packet["action"] as? String else { return }
        switch action {
        case "open":
            guard let raw = packet["url"] as? String, let url = URL(string: raw),
                  allowed(url), url.user == nil, url.password == nil else {
                fail(id, "Socket endpoint is outside the configured xln network."); return
            }
            let task = session.webSocketTask(with: url)
            task.taskDescription = id
            tasks[id] = task
            task.resume()
        case "send":
            guard let task = tasks[id] else { fail(id, "Socket is missing."); return }
            let message: URLSessionWebSocketTask.Message
            if let text = packet["text"] as? String { message = .string(text) }
            else if let encoded = packet["data"] as? String, let data = Data(base64Encoded: encoded) { message = .data(data) }
            else { fail(id, "Invalid socket message."); return }
            task.send(message) { error in
                DispatchQueue.main.async {
                    guard self.tasks[id] === task else { return }
                    if let error { self.fail(id, error.localizedDescription) }
                    else { self.emit(["id": id, "event": "sent", "bytes": packet["bytes"] ?? 0]) }
                }
            }
        case "close":
            let code = URLSessionWebSocketTask.CloseCode(rawValue: packet["code"] as? Int ?? 1000) ?? .normalClosure
            tasks.removeValue(forKey: id)?.cancel(with: code, reason: (packet["reason"] as? String)?.data(using: .utf8))
            emit(["id": id, "event": "close", "code": code.rawValue, "reason": packet["reason"] ?? ""])
        default: fail(id, "Unknown socket operation.")
        }
    }

    func closeAll() {
        // Detach old tasks before cancellation: their late callbacks belong
        // to the terminated session and must never enter the reloaded context.
        let previous = Array(tasks.values)
        tasks.removeAll()
        previous.forEach { $0.cancel(with: .goingAway, reason: nil) }
        print("XLN_RUNTIME_SOCKETS_CLOSED count=\(previous.count)")
    }

    private func allowed(_ url: URL) -> Bool {
        // The runtime also dials peer /ws endpoints discovered through authenticated
        // gossip. Their identity is proved by the canonical signed hello, not by a port.
        guard ["/relay", "/ws"].contains(url.path), url.host != nil else { return false }
        if url.scheme == "wss" { return true }
        let loopback = ["127.0.0.1", "localhost", "::1"]
        return origin.scheme == "http" && loopback.contains(origin.host ?? "")
            && url.scheme == "ws" && loopback.contains(url.host ?? "")
    }

    private func read(_ task: URLSessionWebSocketTask, _ id: String) {
        task.receive { result in
            DispatchQueue.main.async {
                guard self.tasks[id] === task else { return }
                switch result {
                case .success(let message):
                    switch message {
                    case .string(let value): self.emit(["id": id, "event": "message", "text": value])
                    case .data(let value): self.emit(["id": id, "event": "message", "data": value.base64EncodedString()])
                    @unknown default: self.fail(id, "Unsupported socket message."); return
                    }
                    self.read(task, id)
                case .failure(let error): self.fail(id, error.localizedDescription)
                }
            }
        }
    }

    private func fail(_ id: String, _ reason: String) {
        tasks.removeValue(forKey: id)?.cancel(with: .goingAway, reason: nil)
        emit(["id": id, "event": "error", "reason": reason])
        emit(["id": id, "event": "close", "code": 1006, "reason": reason])
    }

    private func emit(_ packet: [String: Any]) {
        webView?.callAsyncJavaScript("window.xlnSocketEvent(packet)", arguments: ["packet": packet], in: nil, in: .page, completionHandler: { result in
            if case .failure(let error) = result { print("XLN_SOCKET_DELIVERY_FAILED: \(error.localizedDescription)") }
        })
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        guard let id = webSocketTask.taskDescription, tasks[id] === webSocketTask else { return }
        emit(["id": id, "event": "open"])
        read(webSocketTask, id)
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        guard let id = webSocketTask.taskDescription, tasks[id] === webSocketTask else { return }
        tasks.removeValue(forKey: id)
        emit(["id": id, "event": "close", "code": closeCode.rawValue, "reason": reason.flatMap { String(data: $0, encoding: .utf8) } ?? ""])
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error, let id = task.taskDescription, tasks[id] === task else { return }
        fail(id, error.localizedDescription)
    }
}
