import Foundation
import WebKit

/// Keep the runtime's canonical relative configuration URL while serving packaged executable code locally.
final class NativeAssetRouter: NSObject, WKURLSchemeHandler {
    private let assets: WKURLSchemeHandler
    private let origin: URL
    private var requests: [ObjectIdentifier: URLSessionDataTask] = [:]
    private let apiPaths = ["/api/jurisdictions", "/api/watchtower-proxy"]

    init(assets: WKURLSchemeHandler, origin: URL) {
        self.assets = assets
        self.origin = origin
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let local = urlSchemeTask.request.url, apiPaths.contains(local.path) else {
            assets.webView(webView, start: urlSchemeTask)
            return
        }
        let method = urlSchemeTask.request.httpMethod ?? "GET"
        let allowedMethods = local.path == "/api/jurisdictions" ? ["GET"] : ["GET", "POST", "PUT"]
        var destination = URLComponents(url: origin, resolvingAgainstBaseURL: false)
        destination?.path = local.path
        destination?.percentEncodedQuery = local.query
        guard allowedMethods.contains(method), let remote = destination?.url else {
            urlSchemeTask.didFailWithError(WalletKeychain.failure("Invalid network configuration request."))
            return
        }
        let id = ObjectIdentifier(urlSchemeTask)
        var request = URLRequest(url: remote, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.httpMethod = method
        request.httpBody = urlSchemeTask.request.httpBody
        request.setValue(urlSchemeTask.request.value(forHTTPHeaderField: "Content-Type"), forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self, self.requests.removeValue(forKey: id) != nil else { return }
                if let error { urlSchemeTask.didFailWithError(error); return }
                guard let data, let http = response as? HTTPURLResponse,
                      let result = HTTPURLResponse(url: local, statusCode: http.statusCode, httpVersion: nil,
                        headerFields: ["Content-Type": http.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream", "Cache-Control": "no-store"]) else {
                    urlSchemeTask.didFailWithError(WalletKeychain.failure("Network configuration response is invalid."))
                    return
                }
                urlSchemeTask.didReceive(result)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
            }
        }
        requests[id] = task
        task.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        if let path = urlSchemeTask.request.url?.path, apiPaths.contains(path) {
            requests.removeValue(forKey: ObjectIdentifier(urlSchemeTask))?.cancel()
        } else { assets.webView(webView, stop: urlSchemeTask) }
    }
}
