import Foundation
import UIKit

/// Réglages de l'app Bento.
/// L'app affiche la webapp Bento (GitHub Pages), qui lit ta base Supabase remplie par la tâche planifiée Claude.
/// Aucune connexion Claude, Google ou Slack dans l'app : seulement ta clé d'accès Bento, collée une fois au premier lancement.
enum BentoConfig {
    /// La webapp Bento : chaque mise à jour poussée sur GitHub arrive dans l'app sans repasser par Xcode
    static let briefURL = URL(string: "https://sholypro.github.io/bento-brief/")!

    /// Toujours la dernière version publiée sur GitHub (pas de copie gardée en cache)
    static func freshRequest() -> URLRequest {
        URLRequest(url: briefURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
    }

    /// Hors ligne : la dernière version téléchargée
    static func cachedRequest() -> URLRequest {
        URLRequest(url: briefURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15)
    }

    /// Sites qui restent dans l'app. Tout le reste (Slack, Gmail, Studio…) s'ouvre dans son app ou dans Safari.
    static let inAppDomains = ["sholypro.github.io"]

    /// Plus de fenêtre de connexion : l'app ne se connecte à aucun compte
    static let loginPopupHosts: [String] = []

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
        url.host?.lowercased() == briefURL.host && url.path.hasPrefix(briefURL.path)
    }

    static func isLoginPage(_ url: URL) -> Bool { false }
}
