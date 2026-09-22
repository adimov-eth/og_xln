import Capacitor
import SwiftUI
import WebKit

final class NativeWalletController: CAPBridgeViewController, WKScriptMessageHandler {
    private let wallet = WalletModel()
    private let sockets = NativeSockets()
    private var lifecycleObservers: [NSObjectProtocol] = []
    private var privacyCover: UIView?
    private var runtimeNavigation: WalletRuntimeNavigation?

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        struct Network: Decodable { let apiBase: URL }
        do {
            guard let assets = configuration.urlSchemeHandler(forURLScheme: "xln"),
                  let url = Bundle.main.url(forResource: "native-network", withExtension: "json", subdirectory: "public") else {
                preconditionFailure("XLN_NATIVE_HOST_CONFIGURATION_MISSING")
            }
            let network = try JSONDecoder().decode(Network.self, from: Data(contentsOf: url))
            sockets.origin = network.apiBase
            // WebKit does not permit replacing a registered scheme handler. Preserve the
            // Capacitor data store/delegates and install the native transport before creation.
            let native = WKWebViewConfiguration()
            native.userContentController = configuration.userContentController
            native.websiteDataStore = configuration.websiteDataStore
            native.preferences = configuration.preferences
            native.defaultWebpagePreferences = configuration.defaultWebpagePreferences
            native.limitsNavigationsToAppBoundDomains = configuration.limitsNavigationsToAppBoundDomains
            native.applicationNameForUserAgent = configuration.applicationNameForUserAgent
            native.allowsInlineMediaPlayback = configuration.allowsInlineMediaPlayback
            native.mediaTypesRequiringUserActionForPlayback = configuration.mediaTypesRequiringUserActionForPlayback
            native.setURLSchemeHandler(NativeAssetRouter(assets: assets, origin: network.apiBase), forURLScheme: "xln")
            return super.webView(with: frame, configuration: native)
        } catch { preconditionFailure("XLN_NATIVE_HOST_CONFIGURATION_INVALID: \(error)") }
    }

    override func capacitorDidLoad() {
        guard let webView else { preconditionFailure("XLN_WEBVIEW_MISSING") }
        webView.configuration.userContentController.add(self, name: "xln")
        webView.configuration.userContentController.add(self, name: "socket")
        sockets.webView = webView
        wallet.webView = webView
        guard let original = webView.navigationDelegate else { preconditionFailure("XLN_NAVIGATION_DELEGATE_MISSING") }
        let navigation = WalletRuntimeNavigation(original: original) { [weak self] in
            self?.wallet.runtimeInterrupted()
            self?.sockets.closeAll()
        }
        runtimeNavigation = navigation
        webView.navigationDelegate = navigation
        webView.scrollView.isScrollEnabled = false
        #if DEBUG
        webView.isInspectable = true
        #endif
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let runtimeView = webView else { preconditionFailure("XLN_WEBVIEW_MISSING") }
        // The runtime is a sibling behind the native UI. Hosting SwiftUI inside
        // WKWebView clips system bars and hides native navigation from VoiceOver.
        view = UIView()
        view.backgroundColor = .systemGroupedBackground
        runtimeView.translatesAutoresizingMaskIntoConstraints = false
        runtimeView.accessibilityElementsHidden = true
        runtimeView.isUserInteractionEnabled = false
        view.addSubview(runtimeView)
        NSLayoutConstraint.activate([
            runtimeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            runtimeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            runtimeView.topAnchor.constraint(equalTo: view.topAnchor),
            runtimeView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        let host = UIHostingController(rootView: WalletRoot(model: wallet))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        host.didMove(toParent: self)
        let center = NotificationCenter.default
        lifecycleObservers = [
            center.addObserver(forName: UIScene.willDeactivateNotification, object: nil, queue: .main) { [weak self] notification in
                guard let self, let scene = notification.object as? UIWindowScene, scene == self.view.window?.windowScene else { return }
                MainActor.assumeIsolated { self.concealWallet() }
            },
            center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) { [weak self] notification in
                guard let self, let scene = notification.object as? UIWindowScene, scene == self.view.window?.windowScene else { return }
                MainActor.assumeIsolated {
                    self.privacyCover?.removeFromSuperview()
                    self.privacyCover = nil
                    self.wallet.concealed = false
                }
            },
            center.addObserver(forName: UIScene.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] notification in
                guard let self, let scene = notification.object as? UIWindowScene, scene == self.view.window?.windowScene else { return }
                Task { @MainActor in await self.wallet.lock() }
            }
        ]
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .default }

    private func concealWallet() {
        wallet.concealed = true
        guard privacyCover == nil, let window = view.window else { return }
        // Cover the window, including presented payment sheets, before iOS takes
        // an app-switcher snapshot. A cover on the root view leaves sheets visible.
        let cover = UIView(frame: window.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = .systemGroupedBackground
        let icon = UIImageView(image: UIImage(systemName: "lock.shield"))
        icon.tintColor = .secondaryLabel
        icon.contentMode = .center
        icon.frame = cover.bounds
        icon.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.addSubview(icon)
        cover.isAccessibilityElement = true
        cover.accessibilityLabel = WalletL10n.text("Wallet locked")
        window.addSubview(cover)
        privacyCover = cover
    }

    deinit { lifecycleObservers.forEach(NotificationCenter.default.removeObserver) }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "xln",
              message.frameInfo.securityOrigin.host == "localhost",
              let payload = message.body as? [String: Any] else {
            wallet.error = "Rejected an untrusted wallet message."
            return
        }
        if message.name == "socket" { sockets.handle(payload) }
        else { wallet.receive(payload) }
    }
}

/// Preserve Capacitor's navigation policy and reload path; invalidate the native
/// session before its process-termination callback creates a fresh JS context.
private final class WalletRuntimeNavigation: NSObject, WKNavigationDelegate {
    private let original: WKNavigationDelegate
    private let interrupted: () -> Void

    init(original: WKNavigationDelegate, interrupted: @escaping () -> Void) {
        self.original = original
        self.interrupted = interrupted
    }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || original.responds(to: selector)
    }

    override func forwardingTarget(for selector: Selector!) -> Any? { original }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        interrupted()
        original.webViewWebContentProcessDidTerminate?(webView)
    }
}
