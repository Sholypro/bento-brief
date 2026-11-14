import SwiftUI
import UIKit
import WebKit

/// État partagé entre la vue web et l'interface SwiftUI
final class BrowserState: ObservableObject {
    @Published var isLoading = true
    @Published var hasLoadedOnce = false
    @Published var failed: String?
    @Published var onBrief = true
    @Published var onLoginPage = false
    weak var webView: WKWebView?

    func reload() {
        failed = nil
        guard let webView else { return }
        // Recharge toujours depuis GitHub pour avoir la dernière version de l'app
        webView.load(BentoConfig.freshRequest())
    }

    func open(_ url: URL) {
        failed = nil
        webView?.load(URLRequest(url: url))
    }

    func openBrief() { open(BentoConfig.briefURL) }
}

/// La webapp Bento dans une vue web plein écran
struct BentoWebView: UIViewRepresentable {
    @ObservedObject var state: BrowserState

    func makeCoordinator() -> Coordinator { Coordinator(state: state) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // garde ta clé d’accès Bento et le dernier brief d’un lancement à l’autre
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = BentoConfig.userAgentSuffix

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false // l’appui long sert à « Important / Pas important », pas à l’aperçu des liens
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        if #available(iOS 16.4, *) {
            webView.isInspectable = true // mode dev : inspectable depuis Safari sur le Mac
        }

        // Tirer vers le bas pour recharger
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pulledToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        // Suit l’adresse affichée
        context.coordinator.urlObservation = webView.observe(\.url, options: [.new]) { [weak coordinator = context.coordinator] view, _ in
            DispatchQueue.main.async { coordinator?.updateLocation(of: view) }
        }

        state.webView = webView
        webView.load(BentoConfig.freshRequest())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let state: BrowserState
        var urlObservation: NSKeyValueObservation?
        private var popup: PopupController?
        private var triedCache = false

        init(state: BrowserState) { self.state = state }

        @objc func pulledToRefresh(_ sender: UIRefreshControl) {
            state.reload()
        }

        func updateLocation(of webView: WKWebView) {
            guard let url = webView.url else { return }
            state.onBrief = BentoConfig.isBrief(url)
            state.onLoginPage = BentoConfig.isLoginPage(url)
        }

        // MARK: Navigation

        func webView(_ webView: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            // Nouvelle fenêtre : décidée plus bas, dans createWebViewWith
            guard let frame = action.targetFrame else { return decisionHandler(.allow) }
            // La page Bento vit dans un cadre de claude.ai : le contenu des cadres est toujours autorisé
            if !frame.isMainFrame { return decisionHandler(.allow) }
            if BentoConfig.staysInApp(url) { return decisionHandler(.allow) }
            openOutside(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.isLoading = true
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            updateLocation(of: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.isLoading = false
            state.hasLoadedOnce = true
            state.failed = nil
            triedCache = false
            webView.scrollView.refreshControl?.endRefreshing()
            updateLocation(of: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handle(error, in: webView)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handle(error, in: webView)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        private func handle(_ error: Error, in webView: WKWebView) {
            webView.scrollView.refreshControl?.endRefreshing()
            state.isLoading = false
            let ns = error as NSError
            if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
            if ns.domain == "WebKitErrorDomain" && ns.code == 102 { return } // lien ouvert dans une autre app
            // Hors ligne : affiche la dernière version téléchargée plutôt qu'une erreur
            let offline = [NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut, NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost]
            if ns.domain == NSURLErrorDomain && offline.contains(ns.code) && !triedCache {
                triedCache = true
                webView.load(BentoConfig.cachedRequest())
                return
            }
            state.failed = ns.localizedDescription
        }

        private func openOutside(_ url: URL) {
            DispatchQueue.main.async { UIApplication.shared.open(url) }
        }

        // MARK: Fenêtres et alertes

        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            let url = action.request.url ?? URL(string: "about:blank")!
            // Liens du brief (Slack, Gmail, Studio) : ouverts dans leur app ou dans Safari
            guard BentoConfig.opensInSheet(url) else {
                openOutside(url)
                return nil
            }
            // Fenêtre de connexion (Google, Apple) : une feuille qui partage la session de l'app
            let child = WKWebView(frame: .zero, configuration: configuration)
            child.uiDelegate = self
            let controller = PopupController(webView: child)
            controller.onClose = { [weak self] in self?.popup = nil }
            popup = controller
            topViewController(of: webView)?.present(controller, animated: true)
            return child
        }

        func webViewDidClose(_ webView: WKWebView) {
            guard let popup, popup.webView === webView else { return }
            popup.dismiss(animated: true)
            self.popup = nil
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(alert, from: webView, orElse: completionHandler)
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            present(alert, from: webView) { completionHandler(false) }
        }

        private func present(_ controller: UIViewController, from view: UIView, orElse fallback: @escaping () -> Void) {
            if let top = topViewController(of: view) {
                top.present(controller, animated: true)
            } else {
                fallback()
            }
        }

        private func topViewController(of view: UIView) -> UIViewController? {
            var top = view.window?.rootViewController
            while let presented = top?.presentedViewController { top = presented }
            return top
        }
    }
}

/// Feuille qui affiche une fenêtre de connexion ouverte par la page
final class PopupController: UIViewController, WKNavigationDelegate {
    let webView: WKWebView
    var onClose: (() -> Void)?

    init(webView: WKWebView) {
        self.webView = webView
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        let close = UIButton(type: .close)
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
        view.addSubview(close)

        NSLayoutConstraint.activate([
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            close.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            webView.topAnchor.constraint(equalTo: close.bottomAnchor, constant: 8),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed { onClose?() }
    }
}
