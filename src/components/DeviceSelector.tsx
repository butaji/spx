import { useState, useRef, useEffect } from "preact/compat";
import { activeDevice, isScanning, isTransferring, allDevices, selectDevice, selectedDeviceId } from "../stores/devices";
import type { SpotifyDevice } from "../types";

interface Props {
  onRefreshLocal: () => void;
}

type TransferStage = "waking" | "starting" | "transferring" | null;

// Device type categories for grouping
interface DeviceCategory {
  name: string;
  icon: string;
}

const DEVICE_CATEGORIES: Record<string, DeviceCategory> = {
  "this-computer": { name: "This computer", icon: "💻" },
  "google-cast": { name: "Google Cast", icon: "📺" },
  "cast-audio": { name: "Speakers", icon: "🔊" },
  "smart-speaker": { name: "Smart Speakers", icon: "🖥️" },
  "other": { name: "Other devices", icon: "📱" },
};

// Helper to categorize a device
function categorizeDevice(device: SpotifyDevice & { isLocal?: boolean; deviceIp?: string; needsWakeUp?: boolean }): string {
  const type = device.type?.toLowerCase() || "";
  const name = device.name?.toLowerCase() || "";
  
  // This computer / local device
  if (device.isLocal === false && device.id !== 'spx-player') {
    return "this-computer";
  }
  
  // Google Cast devices
  if (type.includes("cast_video") || type === "tv" || name.includes("chromecast") || name.includes("nest hub") || name.includes("google tv")) {
    return "google-cast";
  }
  
  // Cast audio / speakers
  if (type.includes("cast_audio") || type === "speaker" || name.includes("home mini") || name.includes("nest mini") || name.includes("google home")) {
    return "cast-audio";
  }
  
  // Smart speakers (Sonos, etc.)
  if (name.includes("sonos") || name.includes("echo") || name.includes("homepod")) {
    return "smart-speaker";
  }
  
  return "other";
}

// Helper to get device icon
function getDeviceIcon(type: string, className: string = "device-type-icon") {
  switch (type?.toLowerCase()) {
    case "computer":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "smartphone":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );
    case "speaker":
    case "cast_audio":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      );
    case "tv":
    case "cast_video":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "avr":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-3.39 0l-1.32-.377a2.25 2.25 0 01-1.632-2.163v-3.75z" />
          <path d="M19.5 10.5c0 .466-.164.9-.442 1.237l-1.32 1.598a2.25 2.25 0 01-3.336 0l-1.32-1.598A1.875 1.875 0 0112.75 10.5h6.75z" />
        </svg>
      );
  }
}

// Device help info based on device state
interface DeviceHelpInfo {
  icon: string;
  text: string;
  type: "info" | "warning" | "error";
}

function getDeviceHelpInfo(device: SpotifyDevice & { isLocal?: boolean; deviceIp?: string; needsWakeUp?: boolean }): DeviceHelpInfo | null {
  // Cast device that needs wake up
  if (device.isLocal && device.needsWakeUp) {
    return {
      icon: "💡",
      text: "Make sure your device is powered on",
      type: "info"
    };
  }
  
  // Restricted device
  if (device.is_restricted) {
    return {
      icon: "🔒",
      text: "Requires Spotify Premium",
      type: "error"
    };
  }
  
  // Local device without Spotify Connect
  if (device.isLocal && !device.canTransfer && !device.needsWakeUp) {
    return {
      icon: "📱",
      text: "Open Spotify on this device first",
      type: "info"
    };
  }
  
  return null;
}

// Transfer status component
function TransferStatus({ stage }: { stage: TransferStage }) {
  if (!stage) return null;
  
  const config = {
    waking: { text: "Waking device...", className: "transfer-waking", icon: "⚡" },
    starting: { text: "Starting Spotify...", className: "transfer-starting", icon: "🚀" },
    transferring: { text: "Transferring...", className: "transfer-transferring", icon: "📡" },
  };
  
  const { text, className, icon } = config[stage];
  
  return (
    <span className={`transfer-status ${className}`}>
      <span className="transfer-icon">{icon}</span>
      <span className="transfer-text">{text}</span>
      <span className="transfer-spinner" />
    </span>
  );
}

export default function DeviceSelector({ onRefreshLocal }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFade, setErrorFade] = useState(false);
  const [transferStage, setTransferStage] = useState<TransferStage>(null);
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  const active = activeDevice.value;
  const scanning = isScanning.value;
  const transferring = isTransferring.value;
  const transferringToId = selectedDeviceId.value;
  const unifiedDevices = allDevices.value;

  // Group devices by category
  const groupedDevices = unifiedDevices.reduce((acc, device) => {
    const category = categorizeDevice(device);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(device);
    return acc;
  }, {} as Record<string, typeof unifiedDevices>);

  // Order categories
  const categoryOrder = ["this-computer", "google-cast", "cast-audio", "smart-speaker", "other"];
  const orderedCategories = categoryOrder.filter(cat => groupedDevices[cat]?.length > 0);

  // Auto-clear error after 3 seconds
  useEffect(() => {
    if (error) {
      setErrorFade(false);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      errorTimerRef.current = window.setTimeout(() => {
        setErrorFade(true);
        errorTimerRef.current = window.setTimeout(() => {
          setError(null);
          setErrorFade(false);
        }, 300);
      }, 3000);
    }
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [error]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-scan local network the first time dropdown opens
  useEffect(() => {
    if (isOpen && !scanning && unifiedDevices.length === 0) {
      onRefreshLocal();
    }
  }, [isOpen]);

  // Simulate transfer stage progress
  useEffect(() => {
    if (!transferring) {
      setTransferStage(null);
      return;
    }
    // Start with waking stage
    setTransferStage("waking");
    const startingTimer = setTimeout(() => setTransferStage("starting"), 800);
    const transferringTimer = setTimeout(() => setTransferStage("transferring"), 2000);

    return () => {
      clearTimeout(startingTimer);
      clearTimeout(transferringTimer);
    };
  }, [transferring]);

  const handleSelectDevice = async (deviceId: string, deviceIp?: string) => {
    if (transferring) return;
    setError(null);
    setErrorFade(false);
    const result = await selectDevice(deviceId, deviceIp);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const getTransferStatusText = (deviceId: string) => {
    if (!transferring || transferringToId !== deviceId) return null;
    return <TransferStatus stage={transferStage} />;
  };

  return (
    <div className="device-selector" ref={ref}>
      <button
        className={`ctrl-btn device-btn ${active ? "active-device" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select playback device"
        title={active?.name || "Select device"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 8v-2M12 18v-2M8 12H6M18 12h-2"/>
        </svg>
        {active && <span className="device-indicator" />}
      </button>

      {isOpen && (
        <div className="device-dropdown">
          <div className="device-dropdown-header">
            <span>{scanning && unifiedDevices.length === 0 ? "Searching for devices..." : "Connect to a device"}</span>
            <button
              className={`device-refresh-btn ${scanning ? 'spinning' : ''}`}
              onClick={() => { onRefreshLocal(); }}
              title="Scan for local devices"
              disabled={scanning}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className={`device-error ${errorFade ? 'fading' : ''}`}>
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Empty state */}
          {unifiedDevices.length === 0 && !scanning && (
            <div className="device-empty">
              <div className="device-empty-icon">📡</div>
              <span className="device-empty-title">No devices found</span>
              <span className="device-empty-hint">
                Make sure your devices are on the same Wi-Fi network and Spotify is running.
              </span>
              <button
                className="device-scan-btn"
                onClick={() => onRefreshLocal()}
                disabled={scanning}
              >
                {scanning ? "Scanning..." : "Scan again"}
              </button>
              <a 
                href="#" 
                className="device-help-link"
                onClick={(e) => {
                  e.preventDefault();
                  // Could open help modal here
                }}
              >
                Need help connecting?
              </a>
            </div>
          )}

          {/* IMPROVEMENT #2: Grouped device list */}
          <div className="device-list">
            {orderedCategories.map((category) => (
              <div key={category} className="device-category">
                <div className="device-section-header">
                  <span className="category-icon">{DEVICE_CATEGORIES[category]?.icon}</span>
                  <span>{DEVICE_CATEGORIES[category]?.name}</span>
                  <span className="category-count">({groupedDevices[category].length})</span>
                </div>
                
                {groupedDevices[category].map((device) => {
                  const isActiveDevice = device.is_active;
                  const isTransferringTo = transferring && transferringToId === device.id;
                  const isDisabled = !device.canTransfer || isTransferringTo;
                  const helpInfo = getDeviceHelpInfo(device as any);
                  const deviceKey = device.id || device.name;

                  return (
                    <button
                      key={deviceKey}
                      className={`device-item ${isActiveDevice ? "active" : ""} ${isTransferringTo ? "transferring" : ""} ${hoveredDevice === deviceKey ? "hovered" : ""}`}
                      onClick={() => !isDisabled && handleSelectDevice(device.id!, (device as any).deviceIp)}
                      onMouseEnter={() => setHoveredDevice(deviceKey || null)}
                      onMouseLeave={() => setHoveredDevice(null)}
                      disabled={isDisabled}
                    >
                      <span className="device-icon">{getDeviceIcon(device.type || "")}</span>
                      <div className="device-info">
                        <div className="device-name-row">
                          <span className="device-name">{device.name}</span>
                          {isActiveDevice && <span className="device-playing-badge">Playing</span>}
                        </div>
                        
                        {/* IMPROVEMENT #3: Enhanced status display */}
                        <div className="device-meta">
                          {isTransferringTo ? (
                            getTransferStatusText(device.id!)
                          ) : (
                            <>
                              {/* Spotify Connect status */}
                              {!(device as any).isLocal && (
                                <span className="device-tag spotify-connect">Spotify Connect</span>
                              )}
                              
                              {/* Local Cast device status */}
                              {(device as any).isLocal && (device as any).needsWakeUp && (
                                <span className="device-tag cast-device">Cast device</span>
                              )}
                              
                              {/* Transfer capability badge */}
                              {(device as any).isLocal && (device as any).canTransfer && !(device as any).needsWakeUp && (
                                <span className="device-tag spotify-connect">Spotify Connect</span>
                              )}
                              
                              {/* Restricted badge */}
                              {!device.is_active && device.is_restricted && (
                                <span className="device-tag restricted">Restricted</span>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* IMPROVEMENT #5: Device-specific help hints */}
                        {helpInfo && hoveredDevice === deviceKey && !isTransferringTo && (
                          <div className={`device-help-hint hint-${helpInfo.type}`}>
                            <span className="help-icon">{helpInfo.icon}</span>
                            <span>{helpInfo.text}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Active indicator / Transfer spinner */}
                      {isActiveDevice && !isTransferringTo && (
                        <span className="device-active-dot" />
                      )}
                      {isTransferringTo && (
                        <span className="device-transferring-spinner" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Scanning indicator */}
          {scanning && unifiedDevices.length > 0 && (
            <div className="device-scanning-indicator">
              <span className="scanning-spinner" />
              <span>Scanning for more devices...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
