import SwiftUI
import VisionKit
import AVFoundation

struct WalletPaymentRequest: Decodable {
    let raw: String
    let recipient: String
    let token: Int
    let tokenLocked: Bool
    let amount: String
    let description: String
}

struct WalletScanner: View {
    let onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var ready = false
    @State private var failure: String?
    @State private var settingsCanHelp = false

    var body: some View {
        NavigationStack {
            Group {
                if let failure {
                    ContentUnavailableView {
                        Label("Camera unavailable", systemImage: "camera")
                    } description: {
                        Text(WalletL10n.text(failure))
                    } actions: {
                        Button("Use payment link") { dismiss() }
                            .buttonStyle(.borderedProminent).accessibilityIdentifier("scanner-use-link")
                        if settingsCanHelp {
                            Button("Open Settings") {
                                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                            }
                        }
                    }
                } else if ready {
                    WalletCamera { value in onScan(value); dismiss() } onFailure: { failure = $0 }
                        .ignoresSafeArea(edges: .bottom)
                } else { ProgressView() }
            }
            .navigationTitle("Scan to pay").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .task {
                guard DataScannerViewController.isSupported else {
                    failure = "QR scanning is unavailable on this device. Paste a payment link instead."; return
                }
                settingsCanHelp = true
                guard await AVCaptureDevice.requestAccess(for: .video) else {
                    failure = "Allow camera access in Settings to scan a payment QR code."; return
                }
                guard DataScannerViewController.isAvailable else {
                    failure = "The camera is unavailable. Check camera restrictions in Settings."; return
                }
                ready = true
            }
        }
    }
}

private struct WalletCamera: UIViewControllerRepresentable {
    let onScan: (String) -> Void
    let onFailure: (String) -> Void
    func makeUIViewController(context: Context) -> WalletCameraController {
        WalletCameraController(onScan: onScan, onFailure: onFailure)
    }
    func updateUIViewController(_ controller: WalletCameraController, context: Context) {}
    static func dismantleUIViewController(_ controller: WalletCameraController, coordinator: ()) { controller.stop() }
}

private final class WalletCameraController: UIViewController, DataScannerViewControllerDelegate {
    private let scanner = DataScannerViewController(
        recognizedDataTypes: [.barcode(symbologies: [.qr])], qualityLevel: .balanced,
        recognizesMultipleItems: false, isHighFrameRateTrackingEnabled: false,
        isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
    private let onScan: (String) -> Void
    private let onFailure: (String) -> Void
    private var delivered = false

    init(onScan: @escaping (String) -> Void, onFailure: @escaping (String) -> Void) {
        self.onScan = onScan; self.onFailure = onFailure
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("Use init(onScan:onFailure:)") }
    override func viewDidLoad() {
        super.viewDidLoad()
        scanner.delegate = self
        addChild(scanner)
        scanner.view.frame = view.bounds
        scanner.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(scanner.view)
        scanner.didMove(toParent: self)
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !delivered else { return }
        do { try scanner.startScanning() }
        catch { onFailure(error.localizedDescription) }
    }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); stop() }
    func stop() { scanner.stopScanning() }
    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for case .barcode(let code) in addedItems {
            guard !delivered, let value = code.payloadStringValue else { continue }
            delivered = true
            stop()
            onScan(value)
            return
        }
    }
    func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        stop(); onFailure(error.localizedDescription)
    }
}
