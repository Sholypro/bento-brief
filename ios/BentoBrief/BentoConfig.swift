import Foundation
import UIKit

/// Réglages de l'app Bento. Le seul à changer un jour : le lien de ta page Claude.
enum BentoConfig {
    /// Ta page Claude « Bento brief » (le brief y est écrit toutes les heures par ta tâche planifiée)
    static let briefURL = URL(string: "https://claude.ai/artifact/HRzsoECnxh1LCaQRmAiv68")!

    /// Sites qui restent dans l'app : Claude et les pages de connexion.
    /// Tout le reste (Slack, Gmail, Studio…) s'ouvre dans son app ou dans Safari.
    static let inAppDomains = [
        "claude.ai", "anthropic.com", "claudeusercontent.com",
        "google.com", "gstatic.com", "googleusercontent.com",
        "apple.com", "icloud.com"
    ]

    /// Fenêtres de connexion qui s'ouvrent dans une feuille par-dessus l'app (et partagent la session)
    static let loginPopupHosts = ["accounts.google.com", "appleid.apple.com", "claude.ai"]

    /// Ajouté à l'identifiant du navigateur pour que Google accepte la connexion dans l'app
    static var userAgentSuffix: String {
        let major = UIDevice.current.systemVersion.split(separator: ".").first ?? "18"
        return "Version/\(major).0 Mobile/15E148 Safari/604.1"
    }

    static func matches(_ host: String?, _ domains: [String]) -> Bool {
        guard let host = host?.lowercased() else { return false }
        return domains.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    static func staysInApp(_ url: URL) -> Bool {
        if let scheme = url.scheme, ["about", "blob", "data"].contains(scheme) { return true }
        return matches(url.host, inAppDomains)
    }

    static func opensInSheet(_ url: URL) -> Bool {
        let s = url.absoluteString
        return s.isEmpty || s == "about:blank" || matches(url.host, loginPopupHosts)
    }

    static func isBrief(_ url: URL) -> Bool {
        url.host?.lowercased() == briefURL.host && url.path == briefURL.path
    }

    static func isLoginPage(_ url: URL) -> Bool {
        let host = url.host?.lowercased() ?? ""
        if host == "accounts.google.com" || host == "appleid.apple.com" { return true }
        return host == "claude.ai" && (url.path.hasPrefix("/login") || url.path.hasPrefix("/magic-link"))
    }
}
