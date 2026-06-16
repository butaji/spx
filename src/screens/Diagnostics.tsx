import { useEffect, useState } from "preact/compat";
import { getAccessToken, ensureValidToken, tauriInvoke } from "../lib/spotify";
import { getTokenInfo } from "../lib/spotify-sdk";
import { isMockMode, authError, appError } from "../stores/spotify";
import {
  availableDevices,
  localDevices,
  activeDevice,
  selectedDeviceId,
  effectiveDeviceId,
  localConnectDeviceId,
  isStartingLocalConnect,
  isCapturingSpDc,
  spDcCaptureError,
  refreshDevices,
} from "../stores/devices";
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  playbackProgress,
  playbackDuration,
  isPlaying,
  likedTrack,
} from "../stores/playback";
import {
  connectionStatus,
  authStatus,
  deviceStatus,
  playbackStatus,
  systemHealth,
  errorHistory,
} from "../stores/notifications";
import { validateToken } from "../stores/auth";

interface BackendDiagnostics {
  credentials: {
    configured: boolean;
    client_id_status: string;
    client_secret_status: string;
    client_id_value?: string;
    client_secret_value?: string;
  };
  has_stored_sp_dc: boolean;
  macos_version: string | null;
  spx_force_librespot: boolean;
  app_version: string;
  tauri_version: string;
}

interface CallbackServerStatus {
  listening: boolean;
  port: number;
  uri: string;
}

interface DiagnosticsSnapshot {
  timestamp: number;
  auth: {
    isAuthenticated: boolean;
    tokenPresent: boolean;
    tokenExpired: boolean;
    expiresAt: number | null;
    hasRefreshToken: boolean;
    tokenPreview: string | null;
    authStatus: string;
    mockMode: boolean;
  };
  environment: {
    vite_spx_mock: boolean;
    vite_spx_diagnostics: boolean;
    vite_spx_debug_token: boolean;
    clientId: string | null;
    redirectUri: string;
    wsUrl: string;
    apiUrl: string;
  };
  playback: {
    trackName: string | null;
    trackUri: string | null;
    artist: string | null;
    isPlaying: boolean;
    volume: number;
    shuffle: boolean;
    repeat: string;
    progress: number;
    duration: number;
    liked: boolean;
  };
  devices: {
    available: number;
    local: number;
    selected: string | null;
    effective: string | null;
    active: string | null;
    spxConnectId: string | null;
    startingSpxConnect: boolean;
    capturingSpDc: boolean;
    spDcError: string | null;
  };
  system: {
    connectionStatus: string;
    authStatus: string;
    deviceStatus: string;
    playbackStatus: string;
    health: object;
    recentErrors: number;
  };
  backend: BackendDiagnostics | null;
}

function maskToken(token: string | null, reveal: boolean): string {
  if (!token) return "(none)";
  if (reveal) return token;
  if (token.length <= 12) return "•".repeat(token.length);
  return `${token.slice(0, 6)}…${token.slice(-6)}`;
}

function maskClientId(id: string | null, reveal: boolean): string {
  if (!id) return "(none)";
  if (reveal) return id;
  if (id.length <= 8) return "•".repeat(id.length);
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function buildSnapshot(backend: BackendDiagnostics | null): DiagnosticsSnapshot {
  const tokenInfo = getTokenInfo();
  const track = playbackTrack.value;
  const artist = track?.artists?.filter(Boolean).map((a: any) => a.name).join(", ") || null;

  return {
    timestamp: Date.now(),
    auth: {
      isAuthenticated: !!getAccessToken(),
      tokenPresent: tokenInfo.present,
      tokenExpired: tokenInfo.expired,
      expiresAt: tokenInfo.expiresAt,
      hasRefreshToken: tokenInfo.hasRefreshToken,
      tokenPreview: tokenInfo.preview,
      authStatus: authStatus.value,
      mockMode: isMockMode.value,
    },
    environment: {
      vite_spx_mock: import.meta.env.VITE_SPX_MOCK === "1",
      vite_spx_diagnostics: import.meta.env.VITE_SPX_DIAGNOSTICS === "1",
      vite_spx_debug_token: import.meta.env.VITE_SPX_DEBUG_TOKEN === "1",
      clientId: backend?.credentials?.client_id_value ?? null,
      redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || "http://127.0.0.1:1422/callback",
      wsUrl: import.meta.env.VITE_WS_URL || "ws://127.0.0.1:1424",
      apiUrl: import.meta.env.VITE_API_URL || "(not set)",
    },
    playback: {
      trackName: track?.name ?? null,
      trackUri: track?.uri ?? null,
      artist,
      isPlaying: isPlaying.value,
      volume: playbackVolume.value,
      shuffle: playbackShuffle.value,
      repeat: playbackRepeat.value,
      progress: playbackProgress.value,
      duration: playbackDuration.value,
      liked: likedTrack.value,
    },
    devices: {
      available: availableDevices.value.length,
      local: localDevices.value.length,
      selected: selectedDeviceId.value,
      effective: effectiveDeviceId.value,
      active: activeDevice.value?.id ?? null,
      spxConnectId: localConnectDeviceId.value,
      startingSpxConnect: isStartingLocalConnect.value,
      capturingSpDc: isCapturingSpDc.value,
      spDcError: spDcCaptureError.value,
    },
    system: {
      connectionStatus: connectionStatus.value,
      authStatus: authStatus.value,
      deviceStatus: deviceStatus.value,
      playbackStatus: playbackStatus.value,
      health: { ...systemHealth.value },
      recentErrors: errorHistory.value.length,
    },
    backend,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDuration(ms: number): string {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Diagnostics() {
  const [revealTokens, setRevealTokens] = useState(false);
  const [backend, setBackend] = useState<BackendDiagnostics | null>(null);
  const [callbackStatus, setCallbackStatus] = useState<CallbackServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkIp, setNetworkIp] = useState("");
  const [networkResult, setNetworkResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      await refreshDevices({ includeLocal: true, force: true });
      const [data, status] = await Promise.all([
        tauriInvoke<BackendDiagnostics>("get_diagnostics"),
        tauriInvoke<CallbackServerStatus>("get_callback_server_status"),
      ]);
      setBackend(data);
      setCallbackStatus(status);
    } catch (e) {
      console.error("[Diagnostics] Failed to load backend diagnostics:", e);
      setBackend(null);
      setCallbackStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const snapshot = buildSnapshot(backend);

  const handleValidateToken = async () => {
    const ok = await validateToken();
    alert(ok ? "Token is valid" : "Token is invalid or expired");
  };

  const handleRunNetworkDiagnostics = async () => {
    if (!networkIp.trim()) return;
    setNetworkResult("Running…");
    try {
      const result = await tauriInvoke<string>("diagnose_network", { ip: networkIp.trim() });
      setNetworkResult(result);
    } catch (e: any) {
      setNetworkResult(`Failed: ${e?.message || String(e)}`);
    }
  };

  const handleCopyReport = async () => {
    const report = revealTokens
      ? snapshot
      : {
          ...snapshot,
          auth: { ...snapshot.auth, tokenPreview: snapshot.auth.tokenPreview ? "[MASKED]" : null },
          environment: {
            ...snapshot.environment,
            clientId: snapshot.environment.clientId ? "[MASKED]" : null,
          },
        };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokenInfo = getTokenInfo();
  const accessToken = getAccessToken();
  const tokenDisplay = maskToken(accessToken, revealTokens);
  const clientIdDisplay = maskClientId(backend?.credentials?.client_id_value || null, revealTokens);

  return (
    <div className="screen diagnostics-screen">
      <div className="diagnostics-header">
        <h1>Diagnostics</h1>
        <div className="diagnostics-actions">
          <label className="diagnostics-toggle">
            <input
              type="checkbox"
              checked={revealTokens}
              onChange={(e) => setRevealTokens((e.target as HTMLInputElement).checked)}
            />
            Reveal tokens
          </label>
          <button className="btn-secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn-secondary" onClick={handleCopyReport}>
            {copied ? "Copied!" : "Copy report"}
          </button>
        </div>
      </div>

      <div className="diagnostics-grid">
        {/* Auth */}
        <section className="diagnostics-card">
          <h2>Auth</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Authenticated</span>
            <span className={`diagnostics-value ${accessToken ? "ok" : "warn"}`}>
              {accessToken ? "Yes" : "No"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Auth status</span>
            <span className="diagnostics-value">{authStatus.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Token present</span>
            <span className="diagnostics-value">{tokenInfo.present ? "Yes" : "No"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Token expired</span>
            <span className={`diagnostics-value ${tokenInfo.expired ? "warn" : "ok"}`}>
              {tokenInfo.expired ? "Yes" : "No"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Expires at</span>
            <span className="diagnostics-value">
              {tokenInfo.expiresAt ? formatDate(tokenInfo.expiresAt) : "(none)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Refresh token</span>
            <span className="diagnostics-value">{tokenInfo.hasRefreshToken ? "Yes" : "No"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Access token</span>
            <code className="diagnostics-value diagnostics-token">{tokenDisplay}</code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Mock mode</span>
            <span className="diagnostics-value">{isMockMode.value ? "Yes" : "No"}</span>
          </div>
          {authError.value && (
            <div className="diagnostics-row">
              <span className="diagnostics-key">Auth error</span>
              <span className="diagnostics-value warn">{authError.value}</span>
            </div>
          )}
          <div className="diagnostics-actions">
            <button className="btn-secondary" onClick={handleValidateToken}>
              Validate token
            </button>
            <button className="btn-secondary" onClick={() => ensureValidToken()}>
              Refresh token
            </button>
          </div>
        </section>

        {/* Environment */}
        <section className="diagnostics-card">
          <h2>Environment</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">VITE_SPX_MOCK</span>
            <span className="diagnostics-value">
              {import.meta.env.VITE_SPX_MOCK === "1" ? "1" : "(unset)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">VITE_SPX_DIAGNOSTICS</span>
            <span className="diagnostics-value">
              {import.meta.env.VITE_SPX_DIAGNOSTICS === "1" ? "1" : "(unset)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">VITE_SPX_DEBUG_TOKEN</span>
            <span className="diagnostics-value">
              {import.meta.env.VITE_SPX_DEBUG_TOKEN === "1" ? "1" : "(unset)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Client ID</span>
            <code className="diagnostics-value diagnostics-token">{clientIdDisplay}</code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Redirect URI</span>
            <span className="diagnostics-value">{snapshot.environment.redirectUri}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">WS URL</span>
            <span className="diagnostics-value">{snapshot.environment.wsUrl}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">API URL</span>
            <span className="diagnostics-value">{snapshot.environment.apiUrl}</span>
          </div>
        </section>

        {/* Playback */}
        <section className="diagnostics-card">
          <h2>Playback</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Track</span>
            <span className="diagnostics-value">{snapshot.playback.trackName || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Artist</span>
            <span className="diagnostics-value">{snapshot.playback.artist || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">URI</span>
            <code className="diagnostics-value">{snapshot.playback.trackUri || "(none)"}</code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Status</span>
            <span className={`diagnostics-value ${isPlaying.value ? "ok" : ""}`}>
              {isPlaying.value ? "Playing" : "Paused"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Progress</span>
            <span className="diagnostics-value">
              {formatDuration(playbackProgress.value)} / {formatDuration(playbackDuration.value)}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Volume</span>
            <span className="diagnostics-value">{playbackVolume.value}%</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Shuffle</span>
            <span className="diagnostics-value">{playbackShuffle.value ? "On" : "Off"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Repeat</span>
            <span className="diagnostics-value">{playbackRepeat.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Liked</span>
            <span className="diagnostics-value">{likedTrack.value ? "Yes" : "No"}</span>
          </div>
        </section>

        {/* Devices */}
        <section className="diagnostics-card">
          <h2>Devices</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Spotify devices</span>
            <span className="diagnostics-value">{availableDevices.value.length}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Local / Cast devices</span>
            <span className="diagnostics-value">{localDevices.value.length}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Selected device</span>
            <span className="diagnostics-value">{selectedDeviceId.value || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Effective device</span>
            <span className="diagnostics-value">{effectiveDeviceId.value || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Active device</span>
            <span className="diagnostics-value">{activeDevice.value?.name || activeDevice.value?.id || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">SPX Connect ID</span>
            <span className="diagnostics-value">{localConnectDeviceId.value || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Starting SPX Connect</span>
            <span className="diagnostics-value">{isStartingLocalConnect.value ? "Yes" : "No"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Capturing sp_dc</span>
            <span className="diagnostics-value">{isCapturingSpDc.value ? "Yes" : "No"}</span>
          </div>
          {spDcCaptureError.value && (
            <div className="diagnostics-row">
              <span className="diagnostics-key">sp_dc error</span>
              <span className="diagnostics-value warn">{spDcCaptureError.value}</span>
            </div>
          )}
          <div className="diagnostics-actions">
            <button className="btn-secondary" onClick={() => refreshDevices({ includeLocal: true, force: true })}>
              Refresh devices
            </button>
          </div>
        </section>

        {/* System */}
        <section className="diagnostics-card">
          <h2>System</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Connection</span>
            <span className="diagnostics-value">{connectionStatus.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Auth status</span>
            <span className="diagnostics-value">{authStatus.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Device status</span>
            <span className="diagnostics-value">{deviceStatus.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Playback status</span>
            <span className="diagnostics-value">{playbackStatus.value}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Internet</span>
            <span className={`diagnostics-value ${systemHealth.value.internet ? "ok" : "warn"}`}>
              {systemHealth.value.internet ? "OK" : "Down"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Spotify API</span>
            <span className={`diagnostics-value ${systemHealth.value.spotifyApi ? "ok" : "warn"}`}>
              {systemHealth.value.spotifyApi ? "OK" : "Down"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">WebSocket</span>
            <span className={`diagnostics-value ${systemHealth.value.websocket ? "ok" : "warn"}`}>
              {systemHealth.value.websocket ? "OK" : "Down"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Recent errors</span>
            <span className="diagnostics-value">{errorHistory.value.length}</span>
          </div>
          {appError.value && (
            <div className="diagnostics-row">
              <span className="diagnostics-key">App error</span>
              <span className="diagnostics-value warn">{appError.value}</span>
            </div>
          )}
        </section>

        {/* Backend */}
        <section className="diagnostics-card">
          <h2>Backend</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">OAuth callback server</span>
            <span className={`diagnostics-value ${callbackStatus?.listening ? "ok" : "warn"}`}>
              {callbackStatus
                ? callbackStatus.listening
                  ? `Listening on ${callbackStatus.uri}`
                  : `Not listening (port ${callbackStatus.port} may be in use)`
                : "(loading)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">App version</span>
            <span className="diagnostics-value">{backend?.app_version || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Tauri version</span>
            <span className="diagnostics-value">{backend?.tauri_version || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Credentials configured</span>
            <span className={`diagnostics-value ${backend?.credentials?.configured ? "ok" : "warn"}`}>
              {backend?.credentials?.configured ? "Yes" : "No"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Client ID status</span>
            <span className="diagnostics-value">{backend?.credentials?.client_id_status || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Client secret status</span>
            <span className="diagnostics-value">{backend?.credentials?.client_secret_status || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Stored sp_dc</span>
            <span className="diagnostics-value">{backend?.has_stored_sp_dc ? "Yes" : "No"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">macOS version</span>
            <span className="diagnostics-value">{backend?.macos_version || "(not macOS)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">SPX_FORCE_LIBRESPOT</span>
            <span className="diagnostics-value">{backend?.spx_force_librespot ? "Yes" : "No"}</span>
          </div>
        </section>

        {/* Network diagnostics */}
        <section className="diagnostics-card diagnostics-card-wide">
          <h2>Network diagnostics</h2>
          <div className="diagnostics-inline">
            <input
              type="text"
              value={networkIp}
              onInput={(e) => setNetworkIp((e.target as HTMLInputElement).value)}
              placeholder="Device IP (e.g. 192.168.1.10)"
              className="diagnostics-input"
            />
            <button className="btn-secondary" onClick={handleRunNetworkDiagnostics} disabled={!networkIp.trim()}>
              Run
            </button>
          </div>
          {networkResult && (
            <pre className="diagnostics-pre">{networkResult}</pre>
          )}
        </section>
      </div>
    </div>
  );
}
