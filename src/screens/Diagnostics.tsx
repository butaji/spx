import { useEffect, useState } from "preact/hooks";
import { getAccessToken, ensureValidToken, tauriInvoke } from "../lib/spotify";
import { getTokenInfo } from "../lib/spotify-sdk";
import { runDiagnostics } from "../lib/errors";
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
  startSpotifyCookieCapture,
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
import { currentDeviceId } from "../lib/playback";

// ─── Console log capture ────────────────────────────────────────────────────────

interface LogEntry {
  ts: number;
  level: "log" | "warn" | "error";
  args: string[];
}

const MAX_LOGS = 200;
const capturedLogs: LogEntry[] = [];

function captureLog(level: LogEntry["level"], args: unknown[]) {
  const text = args.map((a) => {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(" ");
  capturedLogs.push({ ts: Date.now(), level, args: [text] });
  if (capturedLogs.length > MAX_LOGS) capturedLogs.shift();
}

const _origLog = console.log;
const _origWarn = console.warn;
const _origError = console.error;
console.log = (...args: unknown[]) => { _origLog.apply(console, args); captureLog("log", args); };
console.warn = (...args: unknown[]) => { _origWarn.apply(console, args); captureLog("warn", args); };
console.error = (...args: unknown[]) => { _origError.apply(console, args); captureLog("error", args); };

// ─── Rust backend types ─────────────────────────────────────────────────────────

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
  rust_panic_count: number;
  rust_log_lines: string[];
  local_ip: string | null;
  librespot_status: string;
  librespot_device_id: string | null;
}

interface CallbackServerStatus {
  listening: boolean;
  port: number;
  uri: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Full report generator ─────────────────────────────────────────────────────

function buildFullReport(
  backend: BackendDiagnostics | null,
  callbackStatus: CallbackServerStatus | null,
  logEntries: LogEntry[],
  revealTokens: boolean
): string {
  const tokenInfo = getTokenInfo();
  const accessToken = getAccessToken();
  const track = playbackTrack.value;
  const artist = track?.artists?.filter(Boolean).map((a: any) => a.name).join(", ") || null;
  const errors = errorHistory.value;
  const logs = logEntries.slice(-100);

  const sections: string[] = [];
  const sep = "─".repeat(60);

  const tok = revealTokens ? (accessToken || "(none)") : (accessToken ? `${accessToken.slice(0, 6)}…[MASKED]` : "(none)");
  const cid = revealTokens ? (backend?.credentials?.client_id_value || "(none)") : (backend?.credentials?.client_id_value ? `${backend.credentials.client_id_value.slice(0, 4)}…[MASKED]` : "(none)");

  sections.push(`SPX DIAGNOSTICS REPORT — ${formatDate(Date.now())}`);
  sections.push(sep);

  sections.push("## APP INFO");
  sections.push(`  App version : ${backend?.app_version || "?"}`);
  sections.push(`  Tauri version: ${backend?.tauri_version || "?"}`);
  sections.push(`  macOS version: ${backend?.macos_version || "not macOS"}`);
  sections.push(`  Local IP     : ${backend?.local_ip || "?"}`);
  sections.push(sep);

  sections.push("## AUTH");
  sections.push(`  Authenticated   : ${accessToken ? "YES" : "NO"}`);
  sections.push(`  Auth status     : ${authStatus.value}`);
  sections.push(`  Mock mode       : ${isMockMode.value ? "YES" : "NO"}`);
  sections.push(`  Token present   : ${tokenInfo.present ? "YES" : "NO"}`);
  sections.push(`  Token expired   : ${tokenInfo.expired ? "YES (EXPIRED)" : "NO"}`);
  sections.push(`  Token expires at: ${tokenInfo.expiresAt ? formatDate(tokenInfo.expiresAt) : "(none)"}`);
  sections.push(`  Has refresh     : ${tokenInfo.hasRefreshToken ? "YES" : "NO"}`);
  sections.push(`  Access token    : ${tok}`);
  sections.push(`  Auth error      : ${authError.value || "(none)"}`);
  sections.push(sep);

  sections.push("## ENVIRONMENT");
  sections.push(`  VITE_SPX_MOCK         : ${import.meta.env.VITE_SPX_MOCK === "1" ? "1" : "(unset)"}`);
  sections.push(`  VITE_SPX_DIAGNOSTICS  : ${import.meta.env.VITE_SPX_DIAGNOSTICS === "1" ? "1" : "(unset)"}`);
  sections.push(`  Client ID             : ${cid}`);
  sections.push(`  Redirect URI          : ${import.meta.env.VITE_SPOTIFY_REDIRECT_URI || "http://127.0.0.1:1422/callback"}`);
  sections.push(sep);

  sections.push("## BACKEND CREDENTIALS");
  sections.push(`  Configured     : ${backend?.credentials?.configured ? "YES" : "NO"}`);
  sections.push(`  Client ID      : ${backend?.credentials?.client_id_status || "?"}`);
  sections.push(`  Client secret  : ${backend?.credentials?.client_secret_status || "?"}`);
  sections.push(`  Stored sp_dc   : ${backend?.has_stored_sp_dc ? "YES" : "NO"}`);
  sections.push(`  OAuth callback : ${callbackStatus?.listening ? `LISTENING on ${callbackStatus.uri}` : "NOT LISTENING"}`);
  sections.push(`  SPX_FORCE_LIBRESPOT: ${backend?.spx_force_librespot ? "YES" : "NO"}`);
  sections.push(sep);

  sections.push("## LIBRESPOT / SPX CONNECT");
  sections.push(`  Status      : ${backend?.librespot_status || "?"}`);
  sections.push(`  Device ID   : ${backend?.librespot_device_id || "(not started)"}`);
  sections.push(`  Rust panics : ${backend?.rust_panic_count ?? 0}`);
  sections.push(sep);

  sections.push("## PLAYBACK");
  sections.push(`  Track   : ${track?.name || "(none)"}`);
  sections.push(`  Artist  : ${artist || "(none)"}`);
  sections.push(`  URI     : ${track?.uri || "(none)"}`);
  sections.push(`  Playing : ${isPlaying.value ? "YES" : "NO"}`);
  sections.push(`  Progress: ${formatDuration(playbackProgress.value)} / ${formatDuration(playbackDuration.value)}`);
  sections.push(`  Volume  : ${playbackVolume.value}%`);
  sections.push(`  Shuffle : ${playbackShuffle.value ? "ON" : "OFF"}`);
  sections.push(`  Repeat  : ${playbackRepeat.value}`);
  sections.push(`  Liked   : ${likedTrack.value ? "YES" : "NO"}`);
  sections.push(`  App err : ${appError.value || "(none)"}`);
  sections.push(sep);

  sections.push("## DEVICES");
  sections.push(`  SPX Player device ID : ${currentDeviceId || "(not connected)"}`);
  sections.push(`  Selected device ID    : ${selectedDeviceId.value || "(none)"}`);
  sections.push(`  Effective device ID   : ${effectiveDeviceId.value || "(none)"}`);
  sections.push(`  Active device         : ${activeDevice.value?.name || activeDevice.value?.id || "(none)"}`);
  sections.push(`  SPX Connect ID        : ${localConnectDeviceId.value || "(not started)"}`);
  sections.push(`  Starting SPX Connect   : ${isStartingLocalConnect.value ? "YES" : "NO"}`);
  sections.push(`  Capturing sp_dc       : ${isCapturingSpDc.value ? "YES" : "NO"}`);
  sections.push(`  sp_dc error           : ${spDcCaptureError.value || "(none)"}`);
  sections.push("");
  sections.push("  Spotify API devices:");
  for (const d of availableDevices.value) {
    const active = d.is_active ? " [ACTIVE]" : "";
    sections.push(`    - ${d.name} (id=${d.id?.slice(0, 8)}...) type=${d.type}${active}`);
  }
  if (availableDevices.value.length === 0) sections.push("    (none)");
  sections.push("");
  sections.push("  Local / Cast devices:");
  for (const d of localDevices.value) {
    sections.push(`    - ${d.friendly_name || d.name} ip=${d.ip} canTransfer=${d.canTransfer} is_active=${d.is_active}`);
  }
  if (localDevices.value.length === 0) sections.push("    (none)");
  sections.push(sep);

  sections.push("## SYSTEM");
  sections.push(`  Connection  : ${connectionStatus.value}`);
  sections.push(`  Auth status : ${authStatus.value}`);
  sections.push(`  Device status: ${deviceStatus.value}`);
  sections.push(`  Playback    : ${playbackStatus.value}`);
  sections.push(`  Internet    : ${systemHealth.value.internet ? "OK" : "DOWN"}`);
  sections.push(`  Spotify API : ${systemHealth.value.spotifyApi ? "OK" : "DOWN"}`);
  sections.push(`  WebSocket   : ${systemHealth.value.websocket ? "OK" : "DOWN"}`);
  sections.push(`  Recent errors: ${errors.length}`);
  for (const e of errors.slice(-10)) {
    sections.push(`    [${formatDate(e.timestamp)}] ${e.category}: ${e.definition?.message ?? String(e)}`);
  }
  sections.push(sep);

  sections.push("## RUST LOGS (last 30 lines)");
  for (const line of (backend?.rust_log_lines || []).slice(-30)) {
    sections.push(`  ${line}`);
  }
  if (!backend?.rust_log_lines?.length) sections.push("  (none)");
  sections.push(sep);

  sections.push("## JS CONSOLE LOGS (last 50)");
  for (const l of logs.slice(-50)) {
    const ts = new Date(l.ts).toISOString().split("T")[1].replace("Z", "");
    sections.push(`  [${ts}] [${l.level.toUpperCase()}] ${l.args[0]}`);
  }
  sections.push(sep);

  return sections.join("\n");
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const [revealTokens, setRevealTokens] = useState(false);
  const [backend, setBackend] = useState<BackendDiagnostics | null>(null);
  const [callbackStatus, setCallbackStatus] = useState<CallbackServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkIp, setNetworkIp] = useState("");
  const [networkResult, setNetworkResult] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"full" | "json" | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(capturedLogs.slice());
  const [spDcCaptureResult, setSpDcCaptureResult] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      await refreshDevices({ includeLocal: true, force: true });
      runDiagnostics().catch(e => console.error("[Diagnostics] Health check failed:", e));
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
    // Sync captured logs every 2s so we see new entries
    const interval = setInterval(() => setLogEntries(capturedLogs.slice(-200)), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleValidateToken = async () => {
    const ok = await validateToken();
    alert(ok ? "Token is valid" : "Token is invalid or expired");
  };

  const handleCaptureSpDc = async () => {
    setSpDcCaptureResult("Opening Spotify login...");
    const result = await startSpotifyCookieCapture();
    if (result.success) {
      setSpDcCaptureResult("Cookie capture window opened — check for a new window.");
    } else {
      setSpDcCaptureResult(`Error: ${result.error}`);
    }
    // Re-fetch backend state after a moment to pick up the stored cookie
    setTimeout(() => refresh(), 3000);
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
    const text = buildFullReport(backend, callbackStatus, capturedLogs.slice(-200), revealTokens);
    await navigator.clipboard.writeText(text);
    setCopiedType("full");
    setTimeout(() => setCopiedType(null), 3000);
  };

  const handleCopyJson = async () => {
    const snapshot = {
      timestamp: Date.now(),
      auth: {
        isAuthenticated: !!getAccessToken(),
        tokenPresent: getTokenInfo().present,
        tokenExpired: getTokenInfo().expired,
        expiresAt: getTokenInfo().expiresAt,
        hasRefreshToken: getTokenInfo().hasRefreshToken,
        tokenPreview: revealTokens ? getAccessToken() : "[MASKED]",
        authStatus: authStatus.value,
        mockMode: isMockMode.value,
        authError: authError.value,
      },
      environment: {
        vite_spx_mock: import.meta.env.VITE_SPX_MOCK === "1",
        clientId: revealTokens ? (backend?.credentials?.client_id_value ?? null) : "[MASKED]",
        redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || "http://127.0.0.1:1422/callback",
      },
      playback: {
        trackName: playbackTrack.value?.name ?? null,
        trackUri: playbackTrack.value?.uri ?? null,
        isPlaying: isPlaying.value,
        volume: playbackVolume.value,
        shuffle: playbackShuffle.value,
        repeat: playbackRepeat.value,
        progress: playbackProgress.value,
        duration: playbackDuration.value,
        liked: likedTrack.value,
        appError: appError.value,
      },
      devices: {
        availableCount: availableDevices.value.length,
        localCount: localDevices.value.length,
        spxPlayerId: currentDeviceId,
        selectedId: selectedDeviceId.value,
        effectiveId: effectiveDeviceId.value,
        activeId: activeDevice.value?.id ?? null,
        spxConnectId: localConnectDeviceId.value,
        availableDevices: availableDevices.value.map(d => ({ name: d.name, id: d.id, type: d.type, is_active: d.is_active })),
        localDevices: localDevices.value.map(d => ({ name: d.friendly_name || d.name, ip: d.ip, canTransfer: d.canTransfer })),
      },
      system: {
        connectionStatus: connectionStatus.value,
        authStatus: authStatus.value,
        deviceStatus: deviceStatus.value,
        playbackStatus: playbackStatus.value,
        internet: systemHealth.value.internet,
        spotifyApi: systemHealth.value.spotifyApi,
        websocket: systemHealth.value.websocket,
        recentErrors: errorHistory.value.slice(-20),
      },
      backend: backend ? {
        appVersion: backend.app_version,
        tauriVersion: backend.tauri_version,
        macosVersion: backend.macos_version,
        localIp: backend.local_ip,
        credentialsConfigured: backend.credentials.configured,
        hasStoredSpDc: backend.has_stored_sp_dc,
        oauthCallbackListening: callbackStatus?.listening,
        oauthCallbackUri: callbackStatus?.uri,
        librespotStatus: backend.librespot_status,
        librespotDeviceId: backend.librespot_device_id,
        rustPanicCount: backend.rust_panic_count,
        rustLogs: backend.rust_log_lines ?? [],
      } : null,
    };
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopiedType("json");
    setTimeout(() => setCopiedType(null), 3000);
  };

  const errors = errorHistory.value;
  const logs = logEntries.slice(-50);
  const tokenInfo = getTokenInfo();
  const accessToken = getAccessToken();

  const errorMessage = (e: any) =>
    e?.definition?.message ?? e?.message ?? String(e ?? "Unknown error");

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
          <button className="btn-secondary" onClick={handleCopyJson}>
            {copiedType === "json" ? "✓ JSON copied!" : "Copy JSON"}
          </button>
          <button className="btn-primary" onClick={handleCopyReport}>
            {copiedType === "full" ? "✓ Report copied!" : "Copy full report"}
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
              {accessToken ? "Yes" : "NO"}
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
              {tokenInfo.expired ? "YES — EXPIRED" : "No"}
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
            <span className={`diagnostics-value ${tokenInfo.hasRefreshToken ? "ok" : "warn"}`}>
              {tokenInfo.hasRefreshToken ? "Yes" : "NO — can't auto-refresh"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Access token</span>
            <code className="diagnostics-value diagnostics-token">
              {maskToken(accessToken, revealTokens)}
            </code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Mock mode</span>
            <span className="diagnostics-value">{isMockMode.value ? "YES" : "No"}</span>
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

        {/* Playback */}
        <section className="diagnostics-card">
          <h2>Playback</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Track</span>
            <span className="diagnostics-value">{playbackTrack.value?.name || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Artist</span>
            <span className="diagnostics-value">
              {playbackTrack.value?.artists?.filter(Boolean).map((a: any) => a.name).join(", ") || "(none)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">URI</span>
            <code className="diagnostics-value" style={{ fontSize: 10, wordBreak: "break-all" }}>
              {playbackTrack.value?.uri || "(none)"}
            </code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Status</span>
            <span className={`diagnostics-value ${isPlaying.value ? "ok" : ""}`}>
              {isPlaying.value ? "▶ Playing" : "⏸ Paused"}
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
          {appError.value && (
            <div className="diagnostics-row">
              <span className="diagnostics-key">App error</span>
              <span className="diagnostics-value warn">{appError.value}</span>
            </div>
          )}
        </section>

        {/* Devices */}
        <section className="diagnostics-card">
          <h2>Devices</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">SPX Player ID</span>
            <code className="diagnostics-value" style={{ fontSize: 10 }}>
              {currentDeviceId || "(not connected)"}
            </code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Selected</span>
            <span className="diagnostics-value">{selectedDeviceId.value || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Effective</span>
            <span className="diagnostics-value">{effectiveDeviceId.value || "(none)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Active</span>
            <span className="diagnostics-value">
              {activeDevice.value?.name || activeDevice.value?.id || "(none)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">SPX Connect</span>
            <span className="diagnostics-value">
              {localConnectDeviceId.value || "(not started)"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Spotify API</span>
            <span className="diagnostics-value">{availableDevices.value.length} device(s)</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Local / Cast</span>
            <span className="diagnostics-value">{localDevices.value.length} device(s)</span>
          </div>
          <div className="diagnostics-actions">
            <button className="btn-secondary" onClick={() => refreshDevices({ includeLocal: true, force: true })}>
              Refresh devices
            </button>
          </div>

          {availableDevices.value.length > 0 && (
            <>
              <div className="diagnostics-subheading">Spotify API devices</div>
              {availableDevices.value.map((d) => (
                <div key={d.id} className={`diagnostics-device-row ${d.is_active ? "active" : ""}`}>
                  <span className="diagnostics-device-name">
                    {d.is_active ? "▶ " : ""}{d.name}
                  </span>
                  <span className="diagnostics-device-meta">{d.type}</span>
                  <code className="diagnostics-device-id">{d.id?.slice(0, 8)}…</code>
                </div>
              ))}
            </>
          )}

          {localDevices.value.length > 0 && (
            <>
              <div className="diagnostics-subheading">Local / Cast devices</div>
              {localDevices.value.map((d, i) => (
                <div key={i} className="diagnostics-device-row">
                  <span className="diagnostics-device-name">{d.friendly_name || d.name}</span>
                  <span className="diagnostics-device-meta">{d.ip}</span>
                  <span className="diagnostics-device-meta">{d.canTransfer ? "canTransfer" : "Cast-only"}</span>
                </div>
              ))}
            </>
          )}
        </section>

        {/* Backend */}
        <section className="diagnostics-card">
          <h2>Backend</h2>
          <div className="diagnostics-row">
            <span className="diagnostics-key">OAuth callback</span>
            <span className={`diagnostics-value ${callbackStatus?.listening ? "ok" : "warn"}`}>
              {callbackStatus?.listening
                ? `Listening on ${callbackStatus.port}`
                : `Not listening (port ${callbackStatus?.port || "?"} may be in use)`}
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
            <span className="diagnostics-key">macOS version</span>
            <span className="diagnostics-value">{backend?.macos_version || "(not macOS)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Local IP</span>
            <span className="diagnostics-value">{backend?.local_ip || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Credentials</span>
            <span className={`diagnostics-value ${backend?.credentials?.configured ? "ok" : "warn"}`}>
              {backend?.credentials?.configured ? "Configured" : "NOT CONFIGURED"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Client ID</span>
            <code className="diagnostics-value diagnostics-token">
              {maskClientId(backend?.credentials?.client_id_value || null, revealTokens)}
            </code>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Client secret</span>
            <span className="diagnostics-value">{backend?.credentials?.client_secret_status || "(loading)"}</span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Stored sp_dc</span>
            <span className={`diagnostics-value ${backend?.has_stored_sp_dc ? "ok" : ""}`}>
              {backend?.has_stored_sp_dc ? "Yes — Cast enabled" : "No — Cast needs sp_dc"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Cast auth</span>
            <span className="diagnostics-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="btn-secondary"
                onClick={handleCaptureSpDc}
                disabled={isCapturingSpDc.value}
                style={{ fontSize: 12, padding: "2px 10px" }}
              >
                {isCapturingSpDc.value ? "Opening…" : "Capture sp_dc"}
              </button>
              {spDcCaptureResult && (
                <span style={{ fontSize: 11 }}>{spDcCaptureResult}</span>
              )}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">SPX Connect</span>
            <span className="diagnostics-value">
              {backend?.librespot_status === "Running" || backend?.librespot_device_id
                ? `Running (${backend?.librespot_device_id?.slice(0, 8)}…)`
                : backend?.librespot_status || "Stopped"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Rust panics</span>
            <span className={`diagnostics-value ${(backend?.rust_panic_count ?? 0) > 0 ? "error" : "ok"}`}>
              {backend?.rust_panic_count ?? 0}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">FORCE_LIBRESPOT</span>
            <span className="diagnostics-value">{backend?.spx_force_librespot ? "YES" : "No"}</span>
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
              {systemHealth.value.internet ? "OK" : "DOWN"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Spotify API</span>
            <span className={`diagnostics-value ${systemHealth.value.spotifyApi ? "ok" : "warn"}`}>
              {systemHealth.value.spotifyApi ? "OK" : "DOWN"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">WebSocket</span>
            <span className={`diagnostics-value ${systemHealth.value.websocket ? "ok" : "warn"}`}>
              {systemHealth.value.websocket ? "OK" : "DOWN"}
            </span>
          </div>
          <div className="diagnostics-row">
            <span className="diagnostics-key">Recent errors</span>
            <span className={`diagnostics-value ${errors.length > 0 ? "warn" : "ok"}`}>
              {errors.length} — {errors.length > 0 ? "see below" : "none"}
            </span>
          </div>
          {errors.length > 0 && (
            <div className="diagnostics-subheading">Error history</div>
          )}
          {errors.slice(-10).map((e, i) => (
            <div key={i} className="diagnostics-error-row">
              <span className="diagnostics-error-time">{timeSince(e.timestamp)}</span>
              <span className="diagnostics-error-cat">{e.category}</span>
              <span className="diagnostics-error-msg">{errorMessage(e)}</span>
            </div>
          ))}
        </section>

        {/* Console logs */}
        <section className="diagnostics-card diagnostics-card-wide">
          <h2>JS Console Logs (last 50)</h2>
          <div className="diagnostics-logs">
            {logs.length === 0 && <span className="text-muted" style={{ fontSize: 12 }}>No logs captured yet</span>}
            {logs.map((l, i) => (
              <div key={i} className={`diagnostics-log-row diagnostics-log-${l.level}`}>
                <span className="diagnostics-log-ts">
                  {new Date(l.ts).toISOString().split("T")[1].replace("Z", "")}
                </span>
                <span className="diagnostics-log-level">{l.level.toUpperCase()}</span>
                <span className="diagnostics-log-msg">{l.args[0]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Rust logs */}
        {backend && backend.rust_log_lines && backend.rust_log_lines.length > 0 && (
          <section className="diagnostics-card diagnostics-card-wide">
            <h2>Rust Backend Logs (last 30)</h2>
            <div className="diagnostics-logs">
              {(backend.rust_log_lines ?? []).slice(-30).map((line: string, i: number) => (
                <div key={i} className="diagnostics-log-row diagnostics-log-log">
                  <span className="diagnostics-log-msg" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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
