import Foundation

enum APIError: LocalizedError, Sendable {
    case invalidServerURL
    case invalidResponse
    case unauthorized
    case forbidden
    case server(statusCode: Int, message: String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            return "Enter a valid Basemark server URL."
        case .invalidResponse:
            return "The server returned an invalid response."
        case .unauthorized:
            return "The API token was rejected."
        case .forbidden:
            return "The API token is missing the required scope."
        case let .server(statusCode, message):
            return message?.isEmpty == false ? message : "The server returned HTTP \(statusCode)."
        case let .decoding(error):
            return "Failed to decode the server response: \(error.localizedDescription)"
        case let .transport(error):
            return error.localizedDescription
        }
    }
}
