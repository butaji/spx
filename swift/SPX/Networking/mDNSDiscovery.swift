import Foundation

// MARK: - LocalDevice

/// Represents a discovered Cast device on the local network.
public struct CastDevice {
    public let id: String        // Device UUID
    public let name: String      // Friendly name (fn)
    public let model: String     // Model name (md)
    public let host: String      // IP address
    public let port: Int         // Always Cast port

    public init(id: String, name: String, model: String, host: String, port: Int? = nil) {
        self.id = id
        self.name = name
        self.model = model
        self.host = host
        self.port = port ?? Int(Constants.Network.castPort)
    }
}

// MARK: - MDNSDiscovery

/// Discovers Cast devices using Bonjour/mDNS.
/// NSObject-based classes with delegate patterns are not Sendable but we manage thread-safety manually.
public final class MDNSDiscovery: NSObject, @unchecked Sendable {
    private var serviceBrowser: NetServiceBrowser?
    private var discoveredServices: [NetService] = []
    private var resolvingServices: [NetService] = []
    private var devices: [CastDevice] = []
    private var discoveryCompletion: (([CastDevice]) -> Void)?
    private var discoveryTimer: Timer?
    let timeout: TimeInterval

    public init(timeout: TimeInterval = 5.0) {
        self.timeout = timeout
        super.init()
    }

    /// Starts discovery for `_googlecast._tcp` services.
    public func startDiscovery(completion: @escaping ([CastDevice]) -> Void) {
        startDiscovery(timeout: self.timeout, completion: completion)
    }

    /// Starts discovery with specific timeout.
    public func startDiscovery(timeout: TimeInterval, completion: @escaping ([CastDevice]) -> Void) {
        discoveryCompletion = completion
        devices = []
        discoveredServices = []
        resolvingServices = []

        serviceBrowser = NetServiceBrowser()
        serviceBrowser?.delegate = self

        // Search for Cast services
        serviceBrowser?.searchForServices(ofType: "_googlecast._tcp", inDomain: "local.")

        // Set timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            self?.finishDiscovery()
        }
    }

    /// Stops ongoing discovery.
    public func stopDiscovery() {
        serviceBrowser?.stop()
        discoveryTimer?.invalidate()
        discoveryTimer = nil
        resolvingServices.forEach { $0.stop() }
        resolvingServices.removeAll()
    }

    private func finishDiscovery() {
        stopDiscovery()
        discoveryCompletion?(devices)
        discoveryCompletion = nil
    }

    /// Parses mDNS TXT record and returns device info tuple.
    /// Made internal for testing purposes.
    func parseTXTRecord(_ txtRecord: [String: Data]) -> (id: String?, name: String?, model: String?) {
        var id: String?
        var name: String?
        var model: String?

        for (key, value) in txtRecord {
            let valueString = String(data: value, encoding: .utf8)

            switch key.lowercased() {
            case "id":
                id = valueString
            case "fn":
                name = valueString
            case "md":
                model = valueString
            default:
                break
            }
        }

        return (id, name, model)
    }
}

// MARK: - NetServiceBrowserDelegate

extension MDNSDiscovery: NetServiceBrowserDelegate {
    public func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        discoveredServices.append(service)
        resolveService(service)
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
        discoveredServices.removeAll { $0 == service }
        resolvingServices.removeAll { $0 == service }

        // Remove corresponding device
        if let host = service.hostName {
            devices.removeAll { $0.host == host }
        }
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
        finishDiscovery()
    }

    public func netServiceBrowserWillSearch(_ browser: NetServiceBrowser) {
        // Starting search
    }

    public func netServiceBrowserDidStopSearch(_ browser: NetServiceBrowser) {
        // Stopped search
    }

    private func resolveService(_ service: NetService) {
        service.delegate = self
        resolvingServices.append(service)
        service.resolve(withTimeout: timeout)
    }
}

// MARK: - NetServiceDelegate

extension MDNSDiscovery: NetServiceDelegate {
    public func netServiceDidResolveAddress(_ sender: NetService) {
        guard sender.hostName != nil,
              let addresses = sender.addresses,
              !addresses.isEmpty else {
            return
        }

        let deviceInfo = extractDeviceInfo(from: sender)
        guard let ipAddress = extractIPAddress(from: addresses) else {
            resolvingServices.removeAll { $0 == sender }
            return
        }

        let device = CastDevice(
            id: deviceInfo.id ?? sender.name,
            name: deviceInfo.name ?? sender.name,
            model: deviceInfo.model ?? "Unknown",
            host: ipAddress,
            port: sender.port > 0 ? sender.port : 8009
        )

        if !devices.contains(where: { $0.id == device.id }) {
            devices.append(device)
        }

        resolvingServices.removeAll { $0 == sender }
    }

    public func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        resolvingServices.removeAll { $0 == sender }
    }

    private func extractDeviceInfo(from sender: NetService) -> (id: String?, name: String?, model: String?) {
        var deviceId: String?
        var deviceName: String?
        var deviceModel: String?

        if let txtRecord = sender.txtRecordData() {
            let parsed = parseTXTRecord(NetService.dictionary(fromTXTRecord: txtRecord))
            deviceId = parsed.id
            deviceName = parsed.name
            deviceModel = parsed.model
        }

        return (id: deviceId, name: deviceName, model: deviceModel)
    }

    private func extractIPAddress(from addresses: [Data]) -> String? {
        for addressData in addresses {
            if let ip = extractIPFromAddress(addressData) {
                return ip
            }
        }
        return nil
    }

    private func extractIPFromAddress(_ addressData: Data) -> String? {
        var ipAddress: String?

        addressData.withUnsafeBytes { ptr in
            let sockaddr = ptr.assumingMemoryBound(to: sockaddr.self).baseAddress

            if sockaddr?.pointee.sa_family == UInt8(AF_INET) {
                ipAddress = extractIPv4(from: sockaddr)
            } else if sockaddr?.pointee.sa_family == UInt8(AF_INET6) {
                ipAddress = extractIPv6(from: sockaddr)
            }
        }

        return ipAddress
    }

    private func extractIPv4(from sockaddr: UnsafePointer<sockaddr>?) -> String? {
        guard let sockaddr = sockaddr else { return nil }

        var addr = sockaddr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
        var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        inet_ntop(AF_INET, &addr.sin_addr, &buffer, socklen_t(INET_ADDRSTRLEN))
        return String(cString: buffer)
    }

    private func extractIPv6(from sockaddr: UnsafePointer<sockaddr>?) -> String? {
        guard let sockaddr = sockaddr else { return nil }

        var addr = sockaddr.withMemoryRebound(to: sockaddr_in6.self, capacity: 1) { $0.pointee }
        var buffer = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
        inet_ntop(AF_INET6, &addr.sin6_addr, &buffer, socklen_t(INET6_ADDRSTRLEN))
        return String(cString: buffer)
    }
}
