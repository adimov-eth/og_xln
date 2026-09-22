import Cocoa
import WebKit

final class Probe: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let sockets = NativeSockets()
    var view: WKWebView!
    var window: NSWindow!
    var started = false
    func start() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "xln")
        config.userContentController.add(self, name: "socket")
        view = WKWebView(frame: NSRect(x: 0, y: 0, width: 400, height: 700), configuration: config)
        view.navigationDelegate = self
        sockets.webView = view
        sockets.origin = URL(string: "http://127.0.0.1:8082")!
        window = NSWindow(contentRect: view.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = view
        window.orderFront(nil)
        view.load(URLRequest(url: URL(string: "http://localhost:5183/native/index.html")!))
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let packet = message.body as? [String: Any] else { return }
        if message.name == "socket" { sockets.handle(packet); return }
        let kind = packet["kind"] as? String ?? ""
        if kind == "progress" || kind == "error" { print("HOST_\(kind): \(packet["message"] ?? "")"); fflush(stdout) }
        if kind == "ready" && !started {
            started = true
            Task { @MainActor in
                do {
                    let source = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
                    let result = try await view.callAsyncJavaScript(source + "\nreturn await runQuoteSession();", arguments: [:], in: nil, contentWorld: .page)
                    guard let report = result as? String else {
                        print("PROBE_RESULT_MISSING"); exit(1)
                    }
                    print("RESULT \(report)")
                    exit(0)
                } catch { print("PROBE_FAILED \(error)"); exit(1) }
            }
        }
    }
    func webView(_ view: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("NAVIGATION_FAILED \(error)"); exit(1)
    }
}
@main
struct QuoteSessionProbe {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let probe = Probe()
        probe.start()
        DispatchQueue.main.asyncAfter(deadline: .now() + 58) { print("PROBE_TIMEOUT"); exit(2) }
        app.run()
    }
}
