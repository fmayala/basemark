import Foundation

struct ServerConfig: Codable, Hashable, Sendable {
    var serverURL: URL
    var token: String

    init(serverURL: URL, token: String) {
        self.serverURL = serverURL
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func endpoint(_ path: String) -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return serverURL.appending(path: trimmed)
    }

    static func normalizedURL(from value: String) throws -> URL {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard let components = URLComponents(string: candidate), components.host != nil else {
            throw APIError.invalidServerURL
        }

        let normalizedPath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var normalizedComponents = components
        normalizedComponents.path = normalizedPath.isEmpty ? "" : "/\(normalizedPath)"

        guard let finalURL = normalizedComponents.url else {
            throw APIError.invalidServerURL
        }

        return finalURL
    }
}
