import AuthenticationServices
import UIKit

@MainActor
final class WebAuthenticationPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let windowScenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let activeScene = windowScenes.first(where: { $0.activationState == .foregroundActive })
        let keyWindow = activeScene?.windows.first(where: \.isKeyWindow)
            ?? windowScenes.flatMap(\.windows).first(where: \.isKeyWindow)

        return keyWindow ?? UIWindow()
    }
}
