import SwiftUI

struct ContentView: View {
    @StateObject private var browser = BrowserState()
    @Environment(\.scenePhase) private var scenePhase
    @State private var backgroundSince: Date?

    var body: some View {
        ZStack {
            // Même ciel que la page, visible derrière la barre d'état et pendant le chargement
            LinearGradient(
                colors: [Color(hex: 0xA6D0EA), Color(hex: 0xE8EECB), Color(hex: 0xBCD78E), Color(hex: 0x4E8436)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            BentoWebView(state: browser)

            if browser.isLoading && !browser.hasLoadedOnce {
                ProgressView()
                    .controlSize(.large)
                    .tint(Color(hex: 0x1E3A2B))
            }

            if let message = browser.failed {
                OfflineView(message: message) { browser.reload() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !browser.onBrief && browser.hasLoadedOnce {
                HelpBar(browser: browser)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                backgroundSince = Date()
            case .active:
                // Revenu après plus de 2 min : recharge pour avoir la dernière version et le dernier brief
                if let since = backgroundSince, Date().timeIntervalSince(since) > 120 { browser.reload() }
                backgroundSince = nil
            default:
                break
            }
        }
    }
}

/// Barre affichée hors de la page du brief : retour au brief, et aide à la connexion par e-mail
struct HelpBar: View {
    @ObservedObject var browser: BrowserState
    @State private var note: String?

    var body: some View {
        VStack(spacing: 10) {
            if browser.onLoginPage {
                Text("Connexion par e-mail ? Dans Mail, appuie longuement sur le lien de connexion, choisis « Copier le lien », puis touche Coller ici.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            if let note {
                Text(note).font(.footnote.weight(.semibold)).foregroundStyle(.red)
            }
            HStack(spacing: 10) {
                if browser.onLoginPage {
                    PasteButton(payloadType: URL.self) { urls in
                        DispatchQueue.main.async {
                            guard let url = urls.first, BentoConfig.matches(url.host, ["claude.ai"]) else {
                                note = "Ce lien ne vient pas de Claude."
                                return
                            }
                            note = nil
                            browser.open(url)
                        }
                    }
                    .tint(Color(hex: 0x1E3A2B))
                }
                Button {
                    browser.openBrief()
                } label: {
                    Label("Mon brief", systemImage: "square.grid.2x2")
                        .font(.body.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: 0x1E3A2B))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
    }
}

/// Écran affiché si la page ne charge pas (pas de réseau, par exemple)
struct OfflineView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 40, weight: .semibold))
            Text("Le brief ne répond pas")
                .font(.title3.weight(.bold))
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Réessayer", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: 0x1E3A2B))
        }
        .foregroundStyle(Color(hex: 0x14201A))
        .padding(28)
        .frame(maxWidth: 360)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(24)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

#Preview {
    ContentView()
}
