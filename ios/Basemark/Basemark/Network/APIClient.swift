import Foundation

actor APIClient {
    struct TokenIntrospection: Codable, Sendable {
        var valid: Bool
        var tokenId: String
        var scopes: [String]
        var expiresAt: Int?
        var createdAt: Int
    }

    private struct CreateDocumentPayload: Encodable, Sendable {
        var title: String?
        var content: String?
        var collectionId: String?
        var isPublic: Bool
    }

    private struct UpdateDocumentPayload: Encodable, Sendable {
        var title: String?
        var content: String?
        var collectionId: String?
        var isPublic: Bool
        var baseUpdatedAt: Int
    }

    private struct ConflictEnvelope: Decodable, Sendable {
        var error: String
        var document: Document?
    }

    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

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

    func createDocument(config: ServerConfig, draft: DocumentDraft) async throws -> Document {
        let payload = CreateDocumentPayload(
            title: draft.normalizedTitle.isEmpty ? nil : draft.normalizedTitle,
            content: draft.encodedContent,
            collectionId: draft.collectionId,
            isPublic: draft.isPublic
        )
        let request = try makeJSONRequest(
            url: config.endpoint("/api/documents"),
            method: "POST",
            token: config.token,
            body: payload
        )
        let (data, _) = try await perform(request)

        do {
            return try decoder.decode(Document.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func updateDocument(
        config: ServerConfig,
        documentID: String,
        draft: DocumentDraft,
        baseUpdatedAt: Int
    ) async throws -> Document {
        let payload = UpdateDocumentPayload(
            title: draft.normalizedTitle.isEmpty ? nil : draft.normalizedTitle,
            content: draft.encodedContent,
            collectionId: draft.collectionId,
            isPublic: draft.isPublic,
            baseUpdatedAt: baseUpdatedAt
        )
        let request = try makeJSONRequest(
            url: config.endpoint("/api/documents/\(documentID)"),
            method: "PUT",
            token: config.token,
            body: payload
        )
        let (data, _) = try await perform(request)

        do {
            return try decoder.decode(Document.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func deleteDocument(config: ServerConfig, documentID: String) async throws {
        let request = makeRequest(
            url: config.endpoint("/api/documents/\(documentID)"),
            method: "DELETE",
            token: config.token
        )
        _ = try await perform(request)
    }

    private func makeRequest(url: URL, method: String = "GET", token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30
        return request
    }

    private func makeJSONRequest<Body: Encodable>(
        url: URL,
        method: String,
        token: String,
        body: Body
    ) throws -> URLRequest {
        var request = makeRequest(url: url, method: method, token: token)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try encoder.encode(body)
            return request
        } catch {
            throw APIError.transport(error)
        }
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
        case 409:
            let envelope = try? decoder.decode(ConflictEnvelope.self, from: result.0)
            throw APIError.conflict(envelope?.document)
        default:
            let message = String(data: result.0, encoding: .utf8)
            throw APIError.server(statusCode: response.statusCode, message: message)
        }
    }
}
