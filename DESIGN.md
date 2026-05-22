# Spotify Cast CLI — Design Doc

Temporary single-package Go tool that discovers a Google Cast device, launches the Spotify receiver (`CC32E753`), authenticates it, and exposes the device for Web API playback control.

---

## File Layout

```
main.go      // flags, env, orchestration, optional Web API polling
proto.go     // manual varint+wire CastMessage encode / decode
conn.go      // TLS dial + length-prefixed framed I/O
mdns.go      // zeroconf browse for _googlecast._tcp
protocol.go  // virtual CONNECT → heartbeat → LAUNCH → app CONNECT → auth
```

---

## Dependencies

| Import | Purpose | Notes |
|--------|---------|-------|
| `crypto/tls` | TLS to `:8009` | `InsecureSkipVerify: true` required |
| `github.com/grandcat/zeroconf` | mDNS discovery | ~2 transitive deps; swap for UDP multicast stub if dep-free required |
| standard library only for everything else | JSON, HTTP, context, sync, etc. | |

**No protoc / generated pb file.** `CastMessage` has only string/varint fields; manual encoding is ~60 lines.

---

## Message Structs

### `proto.go`

```go
package main

type CastMessage struct {
    SourceID      string
    DestinationID string
    Namespace     string
    PayloadType   int // 0 = STRING, 1 = BINARY
    PayloadUTF8   string
    PayloadBinary []byte
}

// Marshal produces raw protobuf bytes.
// Always emits protocol_version = 0 (field 1, varint).
func (m *CastMessage) Marshal() ([]byte, error)

// Unmarshal parses raw protobuf bytes into the struct.
func UnmarshalCastMessage(b []byte) (*CastMessage, error)
```

Encoding helpers (unexported):

```go
func encodeString(buf *bytes.Buffer, fieldNum int, s string)
func encodeVarint(buf *bytes.Buffer, fieldNum int, v uint64)
func decodeVarint(b []byte) (uint64, int)
```

### `protocol.go` — JSON payloads

```go
type connectMsg struct {
    Type       string `json:"type"`
    Origin     struct{} `json:"origin"`
    UserAgent  string `json:"userAgent"`
    SenderInfo struct {
        SDKType        int    `json:"sdkType"`
        Version        string `json:"version"`
        Platform       int    `json:"platform"`
        ConnectionType int    `json:"connectionType"`
    } `json:"senderInfo"`
}

type launchMsg struct {
    Type      string `json:"type"`
    AppID     string `json:"appId"`
    RequestID int    `json:"requestId"`
}

type getInfoResponse struct {
    Type    string `json:"type"`
    Payload struct {
        RemoteName   string `json:"remoteName"`
        DeviceType   string `json:"deviceType"`
        Version      string `json:"version"`
        ClientID     string `json:"clientID"`
        TokenType    string `json:"tokenType"`
        // ... (sparse decode is fine)
    } `json:"payload"`
}
```

---

## Connection & Framing

### `conn.go`

```go
type CastConn struct {
    tls *tls.Conn
}

// DialCast opens TCP, upgrades to TLS with InsecureSkipVerify.
func DialCast(addr string) (*CastConn, error)

// Send writes [4-byte big-endian length][protobuf].
func (c *CastConn) Send(m *CastMessage) error

// Recv reads a full framed message.
func (c *CastConn) Recv() (*CastMessage, error)

func (c *CastConn) Close() error
```

---

## mDNS Discovery

### `mdns.go`

```go
type device struct {
    Name    string // TXT "fn"
    Addr    string // IP:8009
    Model   string // TXT "md"
    UUID    string // TXT "id"
}

// discover browses _googlecast._tcp for up to timeout.
// If name != "", returns first match on friendly name.
// If name == "", returns first responder.
func discover(ctx context.Context, name string, timeout time.Duration) (*device, error)
```

If multiple devices are found and no `--name` filter is given, print a table and exit with code 2 so the user can re-run with `--name`.

---

## Protocol State Machine

### `protocol.go`

```go
type Client struct {
    conn      *CastConn
    senderID  string // e.g. "sender-" + random 4 hex chars
    reqID     int
}

func NewClient(conn *CastConn) *Client

// PlatformConnect sends CONNECT to "receiver-0".
func (c *Client) PlatformConnect() error

// StartHeartbeat spawns a goroutine that PINGs every 5s.
// Stops when ctx is done. Auto-drops PONG replies in Recv filters.
func (c *Client) StartHeartbeat(ctx context.Context)

// LaunchSpotify sends LAUNCH CC32E753 and blocks until RECEIVER_STATUS
// returns the app's transportId.
func (c *Client) LaunchSpotify(ctx context.Context) (transportID string, err error)

// AppConnect sends a second CONNECT, destination_id = transportID.
func (c *Client) AppConnect(transportID string) error

// WaitForGetInfo blocks until the Spotify receiver sends getInfoResponse.
func (c *Client) WaitForGetInfo(ctx context.Context) (*getInfoResponse, error)

// SendAuthToken transmits the user's access token to the Cast app.
// Exact payload is best-effort (not fully public); see design note below.
func (c *Client) SendAuthToken(token string) error
```

**Internal recv filter** (`recvNonHeartbeat`) skips `PONG` and any unexpected heartbeat traffic so the blocking methods above only see application-level messages.

---

## Auth Token Payload (Best-Effort)

The receiver expects a token message on `urn:x-cast:com.spotify.chromecast.secure.v1`. Because the exact schema is unpublished, the CLI sends a compact JSON payload compatible with observed spotcast / pychromecast behavior:

```json
{
  "type": "addUser",
  "payload": {
    "token": "<SPOTIFY_ACCESS_TOKEN>",
    "tokenType": "accesstoken"
  }
}
```

If this fails to register the device, the CLI prints the raw `getInfoResponse` and the sent payload so the user can inspect / modify.

---

## Web API Helpers (Optional Playback)

### `main.go` (or `spotify.go`)

```go
// pollForDeviceID calls GET /v1/me/player/devices and returns the
// id whose name matches the Cast device's friendly name.
func pollForDeviceID(ctx context.Context, token, deviceName string, maxWait time.Duration) (string, error)

// transferPlayback calls PUT /v1/me/player to transfer to the device.
func transferPlayback(ctx context.Context, token, deviceID, contextURI string) error
```

These are plain `net/http` + `encoding/json`. No external Spotify SDK.

---

## CLI Interface

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-name` | `""` | Filter Cast device by friendly name (TXT `fn`) |
| `-timeout` | `5s` | mDNS discovery timeout |
| `-token` | `""` | Spotify access token (overrides env) |
| `-play` | `""` | If set, poll Web API for device ID and transfer playback to this context URI |
| `-wait` | `15s` | Max time to poll `/v1/me/player/devices` after auth |
| `-verbose` | `false` | Print every sent/received Cast message |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_ACCESS_TOKEN` | Yes* | OAuth2 token with `streaming` scope. Used for Cast auth + Web API. Can be passed via `-token`. |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (device ready, optionally playback started) |
| 1 | General error (TLS failure, I/O, unexpected Cast message) |
| 2 | Multiple Cast devices found; re-run with `-name` |
| 3 | Auth/token exchange failed (device rejected token) |

---

## Main Flow (Exact Order)

```go
func run(ctx context.Context, flags) error {
    1. token := resolveToken(flagToken, env.SPOTIFY_ACCESS_TOKEN)
    2. dev, err := discover(ctx, flagName, flagTimeout)
    3. conn, err := DialCast(dev.Addr) // :8009
    4. client := NewClient(conn)
    5. client.PlatformConnect()          // → receiver-0
    6. go client.StartHeartbeat(ctx)     // 5s PING loop
    7. transportID, err := client.LaunchSpotify(ctx) // LAUNCH CC32E753
    8. client.AppConnect(transportID)    // → transportId
    9. info, err := client.WaitForGetInfo(ctx)
   10. client.SendAuthToken(token)
   11. fmt.Printf("Cast device ready: name=%s type=%s version=%s\n",
                  info.Payload.RemoteName, info.Payload.DeviceType, info.Payload.Version)
   12. if flagPlay != "" {
          deviceID, err := pollForDeviceID(ctx, token, dev.Name, flagWait)
          transferPlayback(ctx, token, deviceID, flagPlay)
       }
   13. return nil
}
```

---

## Design Rationale

- **Manual protobuf** instead of `protoc`/`google.golang.org/protobuf`: only one message type, all scalar fields. Encode is 5 write calls; decode is a tag-switch loop. Keeps the tool `go build`-able with zero codegen steps.
- **zeroconf** instead of raw UDP: mDNS parsing, TXT record extraction, and multicast socket options are subtle and OS-dependent. `grandcat/zeroconf` hides this for ~200 KB of compiled code. If strict dep-free is needed later, `mdns.go` can be swapped for a 30-line UDP query without touching the other files.
- **InsecureSkipVerify**: Required by the protocol; Nest Hub presents a self-signed cert. Documented and scoped only to this Cast connection.
- **No persistent daemon**: The TLS connection is only needed for launch + auth. Heartbeat runs for the lifetime of the CLI process. If the process exits, the Nest Hub's Spotify app stays alive and communicates directly with Spotify's cloud.
- **Web API for playback**: The Cast channel does not carry track commands. Playback control (play/pause/seek) must use Spotify's HTTPS Web API against the now-registered device ID.
