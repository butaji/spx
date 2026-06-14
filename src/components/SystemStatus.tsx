/**
 * System Status Component
 * 
 * Shows the current health status of the application including
 * connection, authentication, and device status.
 */

import { useEffect, useState } from "preact/hooks";
import { 
  connectionStatus, 
  authStatus, 
  deviceStatus, 
  playbackStatus,
  systemHealth,
} from "../stores/notifications";
import { runDiagnostics, type DiagnosticResult } from "../lib/errors";
import styles from "./SystemStatus.module.css";

// ─── Icons ────────────────────────────────────────────────────────────────────

const icons = {
  connected: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
  disconnected: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
  connecting: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class={styles.pulse}>
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
  wifi: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  spotify: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  device: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  icon: preact.ComponentChildren;
  label: string;
  status: "good" | "warning" | "error" | "neutral";
  detail?: string;
}

function StatusBadge({ icon, label, status, detail }: StatusBadgeProps) {
  return (
    <div class={`${styles.badge} ${styles[status]}`} title={detail}>
      <span class={styles.badgeIcon}>{icon}</span>
      <span class={styles.badgeLabel}>{label}</span>
      {detail && <span class={styles.badgeDetail}>{detail}</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function SystemStatus() {
  const [expanded, setExpanded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  
  // Get status from stores
  const conn = connectionStatus.value;
  const auth = authStatus.value;
  const device = deviceStatus.value;
  const playback = playbackStatus.value;
  const health = systemHealth.value;
  
  // Determine overall status
  const getOverallStatus = (): "good" | "warning" | "error" | "neutral" => {
    if (conn === "disconnected") return "error";
    if (auth === "expired" || auth === "unauthenticated") return "warning";
    if (device === "error") return "error";
    if (device === "none") return "warning";
    if (conn === "connecting") return "warning";
    return "good";
  };
  
  const overallStatus = getOverallStatus();
  
  // Run diagnostics periodically
  useEffect(() => {
    const runCheck = async () => {
      setIsRunningDiagnostics(true);
      try {
        const results = await runDiagnostics();
        setDiagnostics(results);
      } catch (e) {
        console.error("[SystemStatus] Diagnostics failed:", e);
      }
      setIsRunningDiagnostics(false);
    };
    
    // Initial run
    runCheck();
    
    // Run every 30 seconds
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Get status text
  const getStatusText = () => {
    if (conn === "disconnected") return "Offline";
    if (conn === "connecting") return "Connecting...";
    if (auth === "expired") return "Session Expired";
    if (auth === "unauthenticated") return "Not Signed In";
    if (device === "none") return "No Device";
    if (device === "error") return "Device Error";
    if (playback === "playing") return "Playing";
    return "Ready";
  };
  
  // Get connection detail
  const getConnectionDetail = () => {
    if (conn === "disconnected") return "Check internet";
    if (conn === "connecting") return "Please wait...";
    if (health.internet) return "Internet OK";
    return "Internet unknown";
  };
  
  // Get auth detail
  const getAuthDetail = () => {
    if (auth === "authenticated") return "Spotify connected";
    if (auth === "expired") return "Re-authenticate";
    return "Sign in needed";
  };
  
  // Get device detail
  const getDeviceDetail = () => {
    if (device === "available") return playback === "playing" ? "Controlling playback" : "Device connected";
    if (device === "none") return "Open Spotify app";
    if (device === "error") return "Check devices";
    return "Checking...";
  };
  
  // Map to badge status
  const connStatus = conn === "connected" ? "good" : conn === "connecting" ? "warning" : "error";
  const authBadgeStatus = auth === "authenticated" ? "good" : auth === "expired" ? "error" : "warning";
  const deviceBadgeStatus = device === "available" ? "good" : device === "error" ? "error" : "warning";
  
  return (
    <div class={styles.container}>
      <button 
        class={`${styles.toggle} ${styles[overallStatus]}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="System status"
      >
        <span class={styles.statusDot} />
        <span class={styles.statusText}>{getStatusText()}</span>
        <span class={`${styles.chevron} ${expanded ? styles.expanded : ""}`}>
          {icons.chevron}
        </span>
      </button>
      
      {expanded && (
        <div class={styles.panel}>
          <div class={styles.header}>
            <h4 class={styles.title}>System Status</h4>
            <button 
              class={styles.refreshButton}
              onClick={async () => {
                setIsRunningDiagnostics(true);
                try {
                  const results = await runDiagnostics();
                  setDiagnostics(results);
                } finally {
                  setIsRunningDiagnostics(false);
                }
              }}
              disabled={isRunningDiagnostics}
            >
              {isRunningDiagnostics ? "Checking..." : "Refresh"}
            </button>
          </div>
          
          <div class={styles.badges}>
            <StatusBadge 
              icon={icons.wifi} 
              label="Connection" 
              status={connStatus}
              detail={getConnectionDetail()}
            />
            <StatusBadge 
              icon={icons.spotify} 
              label="Spotify" 
              status={authBadgeStatus}
              detail={getAuthDetail()}
            />
            <StatusBadge 
              icon={icons.device} 
              label="Device" 
              status={deviceBadgeStatus}
              detail={getDeviceDetail()}
            />
          </div>
          
          {diagnostics.length > 0 && (
            <div class={styles.diagnostics}>
              <h5 class={styles.diagnosticsTitle}>Diagnostics</h5>
              {diagnostics.map((result, i) => (
                <div 
                  key={i} 
                  class={`${styles.diagnosticItem} ${result.passed ? styles.pass : styles.fail}`}
                >
                  <span class={styles.diagnosticDot} />
                  <span class={styles.diagnosticName}>{result.name}</span>
                  <span class={styles.diagnosticMessage}>{result.message}</span>
                </div>
              ))}
            </div>
          )}
          
          <div class={styles.helpSection}>
            <p class={styles.helpText}>
              Having issues? Check the notification bell for error messages with solutions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
