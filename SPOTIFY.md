Here is the full protocol stack, exact enough to implement from scratch.

---

## 1. Discovery — mDNS/Zeroconf

Google Nest Hub advertises itself via mDNS. It is **not** a native Spotify Connect device; it is a Google Cast receiver. Spotify desktop switched to Cast protocol for Nest/ChromeCast devices in 2020.

**Query for:**
```
_googlecast._tcp
```

You can browse live on macOS:
```bash
dns-sd -B _googlecast._tcp
```

The TXT record in the response contains:
- `id` — device UUID
- `fn` — friendly name (e.g. "Living Room Hub")
- `md` — model name
- `ve` — protocol version
- `ca` — capabilities bitmask
- `st` — status (0 = standby, 1 = active)

**Port is always 8009.**

---

## 2. Transport — TLS over TCP

Open a plain TCP socket to `<device_ip>:8009`, then immediately start a TLS handshake.

**Critical:** The Nest Hub presents a **self-signed certificate**. Your TLS client must skip verification (`InsecureSkipVerify: true`), otherwise the handshake fails.

Cipher suites vary by hardware generation (AES128-GCM, AES256-GCM, or AES256-SHA).

---

## 3. Wire format — Length-prefixed protobuf

All messages on the TLS socket use this framing:

```
[ 4 bytes: message length, big-endian uint32 ]
[ N bytes: protobuf-serialized CastMessage ]
```

The protobuf schema (`cast_channel.proto`) is in the Chromium source tree.

```protobuf
message CastMessage {
  enum ProtocolVersion { CASTV2_1_0 = 0; }
  required ProtocolVersion protocol_version = 1;
  required string source_id = 2;
  required string destination_id = 3;
  required string namespace = 4;
  enum PayloadType { STRING = 0; BINARY = 1; }
  required PayloadType payload_type = 5;
  optional string payload_utf8 = 6;
  optional bytes payload_binary = 7;
}
```

**IDs:**
- `source_id`: your sender identifier, e.g. `sender-0` or a random string
- `destination_id`: `receiver-0` for the platform, or the app's `transportId` once launched

---

## 4. Virtual connection handshake

After TLS is up, you must open a virtual connection to the Cast platform:

**Namespace:** `urn:x-cast:com.google.cast.tp.connection`

```json
{
  "type": "CONNECT",
  "origin": {},
  "userAgent": "Spotify/1234567890",
  "senderInfo": {
    "sdkType": 2,
    "version": "1.0.0",
    "platform": 4,
    "connectionType": 1
  }
}
```

Then start heartbeats every ~5 seconds on:

**Namespace:** `urn:x-cast:com.google.cast.tp.heartbeat`

```json
{ "type": "PING" }
```

The device replies with:
```json
{ "type": "PONG" }
```

If you miss a heartbeat, the device drops the TLS connection immediately.

---

## 5. Launch the Spotify receiver app

**Namespace:** `urn:x-cast:com.google.cast.receiver`

```json
{
  "type": "LAUNCH",
  "appId": "CC32E753",
  "requestId": 1
}
```

`CC32E753` is the hardcoded Spotify receiver app ID.

The Nest Hub will spawn a concealed Chrome browser and load the Spotify Cast Receiver web app. You will receive back:

```json
{
  "type": "RECEIVER_STATUS",
  "requestId": 1,
  "status": {
    "applications": [{
      "appId": "CC32E753",
      "sessionId": "<uuid>",
      "transportId": "<uuid>",
      "namespaces": [
        {"name": "urn:x-cast:com.spotify.chromecast.secure.v1"}
      ]
    }]
  }
}
```

**Important:** You must now send a second `CONNECT` message, but this time with `destination_id` set to the app's `transportId` (not `receiver-0`). This joins the app's namespace channel.

---

## 6. Spotify-specific auth protocol

Once connected to the app, the Spotify receiver sends a message on:

**Namespace:** `urn:x-cast:com.spotify.chromecast.secure.v1`

Example payload from the device:
```json
{
  "type": "getInfoResponse",
  "payload": {
    "version": "2.9.0",
    "publicKey": "empty",
    "remoteName": "Spotify on Cast",
    "deviceType": "cast_video",
    "brandDisplayName": "google",
    "modelDisplayName": "Chromecast_Tv",
    "libraryVersion": "5.30.3",
    "resolverVersion": "1",
    "groupStatus": "NONE",
    "deviceAPI_isGroup": false,
    "tokenType": "accesstoken",
    "clientID": "d7df0887fb71494ea994202cb473eae7",
    "productID": 0,
    "scope": "streaming",
    "availability": "",
    "spotifyError": 0,
    "status": 101,
    "statusString": "OK"
  }
}
```

You must reply with the user's Spotify access token. The exact message format is not fully public, but the flow is:

1. You send the token to the Cast receiver app via the secure namespace
2. The receiver app authenticates itself to Spotify's backend using that token
3. The device then appears as an active Spotify Connect device in Spotify's cloud

This is where open-source implementations like `pychromecast` + `spotcast` operate.

---

## 7. Start playback — Spotify Web API, **not** Cast

Here is the key architectural point: **the Cast channel does not carry "play track X" commands.** Once the Spotify receiver app is authenticated, the Nest Hub itself connects directly to Spotify's CDN and control servers.

To actually start music, your desktop app (or your implementation) must:

1. **Get a Spotify access token** (OAuth2, `streaming` scope)
2. **Find the device ID** — after auth, the Nest Hub registers itself with Spotify's backend. You poll Spotify's `/v1/me/player/devices` endpoint to get the `id` string for the Cast device.
3. **Transfer playback** — call:
   ```
   PUT /v1/me/player
   {
     "device_ids": ["<<spotify_device_id>"],
     "play": true
   }
   ```
   or start a context directly with:
   ```
   PUT /v1/me/player/play?device_id=<id>
   {
     "context_uri": "spotify:playlist:...",
     "offset": {"position": 0}
   }
   ```

The Nest Hub's Spotify web app receives this command from Spotify's cloud and begins streaming audio directly from Spotify's servers. The Cast TLS connection from your machine is only used for launch, auth, and heartbeat.

---

## 8. Summary of packet flow

| Step | Direction | Namespace | Payload |
|------|-----------|-----------|---------|
| 1. mDNS query | UDP multicast | — | `_googlecast._tcp` |
| 2. TCP + TLS | → device:8009 | — | `InsecureSkipVerify` |
| 3. Virtual connect | → `receiver-0` | `urn:x-cast:com.google.cast.tp.connection` | `{"type":"CONNECT"}` |
| 4. Heartbeat | ↔ | `urn:x-cast:com.google.cast.tp.heartbeat` | `{"type":"PING"}` / `{"type":"PONG"}` |
| 5. Launch | → `receiver-0` | `urn:x-cast:com.google.cast.receiver` | `{"type":"LAUNCH","appId":"CC32E753"}` |
| 6. App connect | → `transportId` | `urn:x-cast:com.google.cast.tp.connection` | `{"type":"CONNECT"}` |
| 7. Auth exchange | ↔ | `urn:x-cast:com.spotify.chromecast.secure.v1` | `getInfoResponse` + token send |
| 8. Playback | — | **Spotify Web API** (HTTPS) | `PUT /v1/me/player` |

---

## 9. Reference implementations

- **Node.js:** `node-castv2` — implements the raw CASTV2 protobuf/TLS layer.
- **Python:** `pychromecast` — high-level Cast controller, includes `SpotifyController` class that handles `CC32E753` launch and auth.
- **C:** `gcast` / `chromecast-connect` blog series — documents protobuf-c and TLS setup.

If you are building this in Rust, you need:
1. An mDNS library (`mdns`, `zeroconf`)
2. A TLS client (`rustls` with custom cert verifier to allow self-signed, or `native-tls`)
3. `prost` for protobuf codegen from `cast_channel.proto`
4. A JSON serializer for the string payloads
5. Spotify Web API client (`rspotify` or custom) for the actual playback control



------------------------




For a Tauri app to discover and talk to local network devices (Nest Hub, etc.) on macOS, you need three layers of permissions. Missing any layer = silent failures.

---

## 1. App Sandbox entitlements (network)

Tauri's frontend↔backend IPC uses the network loopback interface, so even a minimal Tauri app needs these in sandboxed production builds:

**`src-tauri/Entitlements.plist`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<<plist version="1.0">
<<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    
    <!-- Outbound connections (Spotify API, CDN, Cast TLS) -->
    <key>com.apple.security.network.client</key>
    <true/>
    
    <!-- Incoming connections (if your Rust side binds a local port) -->
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
```

**`tauri.conf.json`**
```json
{
  "bundle": {
    "macOS": {
      "entitlements": "./Entitlements.plist"
    }
  }
}
```

Without `network.client`, the production `.app` will white-screen because the WebView cannot talk to the Rust backend.

---

## 2. Local Network Privacy (macOS 15+ Sequoia)

Since macOS 15, any app that uses Bonjour/mDNS or direct connections to LAN IPs triggers a **"Local Network" permission prompt**. If the user denies it, or if your app lacks the required key, mDNS discovery and Cast connections to `192.168.x.x` are **silently dropped**.

Add to **`src-tauri/Info.plist`**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<<plist version="1.0">
<<dict>
    <key>NSLocalNetworkUsageDescription</key>
    <string>This app discovers Spotify Connect and Google Cast devices on your local network.</string>
</dict>
</plist>
```

Tauri merges this `Info.plist` into the generated bundle automatically.

---

## 3. Multicast / Bonjour entitlement (the hidden one)

Standard sandbox entitlements do **not** cover mDNS multicast. To send/receive UDP 5353 multicast packets for `_googlecast._tcp` discovery, you need the **multicast entitlement** from Apple:

```
com.apple.developer.networking.multicast
```

This is **not** a self-service entitlement. You must:
1. Enroll in Apple Developer Program ($99/yr)
2. Request the multicast entitlement via [Apple's online form](https://developer.apple.com/contact/request/networking-multicast)
3. Apple adds it to your App ID / provisioning profile
4. You embed the provisioning profile in your Tauri bundle

**`tauri.conf.json`**
```json
{
  "bundle": {
    "macOS": {
      "files": {
        "embedded.provisionprofile": "path/to/your.provisionprofile"
      }
    }
  }
}
```

Without this, `mdns-sd` or any Rust mDNS library will fail to see Cast devices on the LAN.

---

## 4. Code signing is mandatory

Entitlements are **only enforced when the app is signed**. In `tauri dev`, the binary runs unsigned and macOS applies a different (looser) policy. Do not test network permissions in dev mode — they will not match production behavior.

Test your sandboxed build locally:
```bash
tauri build --bundles app
# then sign manually for testing
codesign --force --deep --sign - --entitlements src-tauri/Entitlements.plist target/release/bundle/macos/YourApp.app
open target/release/bundle/macos/YourApp.app
```

Unsigned builds ignore entitlements, so you will not catch Local Network blocks until you sign.

---

## 5. Complete checklist

| Layer | File / Step | Required for |
|-------|-------------|--------------|
| Sandbox network | `Entitlements.plist` + `network.client` | Any Tauri app to not white-screen |
| Local network prompt | `Info.plist` + `NSLocalNetworkUsageDescription` | macOS 15+ LAN device access |
| mDNS multicast | Apple Developer + multicast entitlement request | Discovering Cast/Connect devices |
| Code signing | `codesign` or proper cert | Entitlements to actually apply |
| Provisioning profile | `embedded.provisionprofile` in bundle | Multicast entitlement distribution |

---

## 6. Debugging if it still fails

```bash
# Check if your app appears in Local Network permissions
# System Settings → Privacy & Security → Local Network

# Reset the permission for testing
tccutil reset LocalNetwork com.your.bundle.id

# Watch the permission prompt in Console.app
# Filter by process "tccd" or your app name
```

If your app does not appear in **Settings → Privacy & Security → Local Network**, the `NSLocalNetworkUsageDescription` key is missing or malformed, or you have multiple versions of the same bundle ID installed (macOS 15 bug).