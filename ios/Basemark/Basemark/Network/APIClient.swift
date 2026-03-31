import Foundation

actor APIClient {
    struct TokenIntrospection: Codable, Sendable {
        var valid: Bool
        var tokenId: String
        var scopes: [String]
        var expiresAt: Int?
        var createdAt: Int
    }

    private let session: URLSession
    private let decoder = JSONDecoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func introspect(config: ServerConfig) async throws -> TokenIntrospection {
        let request = makeRequest(url: config.endpoint("/api/tokens/introspect"), token: config.token)
        let (data, response) = try await perform(request)
        let result: TokenIntrospection

        do {
            result = try decoder.decode(TokenIntrospection.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }

        guard result.valid else {
            throw APIError.unauthorized
        }

        _ = response
        return result
    }

    func fetchChanges(config: ServerConfig, cursor: Int?, limit: Int = 200) async throws -> SyncResponse {
        var components = URLComponents(url: config.endpoint("/api/sync/changes"), resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(limit))
        ]

        if let cursor {
            items.append(URLQueryItem(name: "cursor", value: String(cursor)))
        }

        components?.queryItems = items

        guard let url = components?.url else {
            throw APIError.invalidServerURL
        }

        let request = makeRequest(url: url, token: config.token)
        let (data, _) = try await perform(request)

        do {
            return try decoder.decode(SyncResponse.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func makeRequest(url: URL, token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let result: (Data, URLResponse)

        do {
            result = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }

        guard let response = result.1 as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch response.statusCode {
        case 200 ..< 300:
            return (result.0, response)
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        default:
            let message = String(data: result.0, encoding: .utf8)
            throw APIError.server(statusCode: response.statusCode, message: message)
        }
    }
}
