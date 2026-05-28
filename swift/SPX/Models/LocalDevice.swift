import Foundation

struct LocalDevice: Codable, Hashable, Sendable {
    let name: String
    let ipAddress: String?
    let port: Int
    let id: String?
    let isActive: Bool?
    let canTransfer: Bool?
    let note: String?
    let serviceType: String?
    let friendlyName: String?

    enum CodingKeys: String, CodingKey {
        case name, port, id, note
        case ipAddress = "ip"
        case isActive = "is_active"
        case canTransfer = "canTransfer"
        case serviceType = "service_type"
        case friendlyName = "friendly_name"
    }
}
