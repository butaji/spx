import { useState, useRef, useEffect, useMemo } from "preact/compat";
import { memo } from "preact/compat";
import {
  activeDevice,
  isScanning,
  isTransferring,
  isStartingLocalConnect,
  localConnectDeviceId,
  allDevices,
  selectDevice,
  startLocalConnectDevice,
  selectedDeviceId,
  scanError,
  lastTransferUsedFallback,
  refreshSpotifyDevices,
  refreshLocalDevices,
} from "../stores/devices";
import type { SpotifyDevice } from "../types";
import {
  IconMonitor,
  IconVolume,
  IconSpeaker,
  IconMobile,
} from "./icons";

interface Props {
  onRefreshLocal: () => void;
}

interface Group {
  key: string;
  label: string;
  devices: SpotifyDevice[];
}

function getDeviceIcon(type: string) {
  switch (type?.toLowerCase()) {
    case "computer":
      return <IconMonitor size={18} className="device-type-icon" />;
    case "smartphone":
      return <IconMobile size={18} className="device-type-icon" />;
    case "speaker":
    case "cast_audio":
      return <IconVolume size={18} className="device-type-icon" />;
    case "tv":
    case "cast_video":
      return <IconMonitor size={18} className="device-type-icon" />;
    case "avr":
      return <IconSpeaker size={18} className="device-type-icon" />;
    default:
      return <IconSpeaker size={18} className="device-type-icon" />;
  }
}

function groupDevices(devices: SpotifyDevice[]): Group[] {
  const thisMac: SpotifyDevice[] = [];
  const speakers: SpotifyDevice[] = [];
  const others: SpotifyDevice[] = [];

  for (const device of devices) {
    if (!device) continue;
    const type = device.type?.toLowerCase() || "";
    const name = device.name?.toLowerCase() || "";

    if (device.id === "spx-player" || type === "computer" || name.includes("this computer")) {
      thisMac.push(device);
    } else if (
      type.includes("cast") ||
      type === "speaker" ||
      type === "avr" ||
      name.includes("home mini") ||
      name.includes("nest mini") ||
      name.includes("google home") ||
      name.includes("sonos") ||
      name.includes("echo") ||
      name.includes("homepod")
    ) {
      speakers.push(device);
    } else {
      others.push(device);
    }
  }

  return [
    { key: "this-mac", label: "This Mac", devices: thisMac },
    { key: "speakers", label: "Speakers", devices: speakers },
    { key: "other", label: "Other devices", devices: others },
  ].filter((g) => g.devices.length > 0);
}

function DeviceSelector({ onRefreshLocal }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active = activeDevice.value;
  const scanning = isScanning.value;
  const transferring = isTransferring.value;
  const startingLocalConnect = isStartingLocalConnect.value;
  const transferringToId = selectedDeviceId.value;
  const unifiedDevices = allDevices.value;
  const deviceScanError = scanError.value;
  const hasLocalConnect = !!localConnectDeviceId.value;

  const displayError = error || deviceScanError;
  const groups = useMemo(() => groupDevices(unifiedDevices), [unifiedDevices]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Clear fallback notice after a few seconds
  useEffect(() => {
    if (!lastTransferUsedFallback.value) return;
    const timer = window.setTimeout(() => {
      lastTransferUsedFallback.value = false;
    }, 4000);
    return () => clearTimeout(timer);
  }, [lastTransferUsedFallback.value]);

  // Refresh devices when opening the dropdown if the list looks empty/stale
  useEffect(() => {
    if (!isOpen) return;
    if (unifiedDevices.length === 0 && !isScanning.value) {
      refreshSpotifyDevices().catch(console.warn);
      refreshLocalDevices(true).catch(console.warn);
    }
  }, [isOpen]);

  const handleSelectDevice = async (deviceId: string, deviceIp?: string) => {
    if (transferring) return;
    setError(null);
    const result = await selectDevice(deviceId, deviceIp);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const handleStartLocalConnect = async () => {
    if (startingLocalConnect || hasLocalConnect) return;
    setError(null);
    const result = await startLocalConnectDevice("SPX Connect", 50);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const toggleDropdown = () => {
    setIsOpen((open) => !open);
  };

  const activeName = active?.name || "Select device";

  return (
    <div className="device-selector" ref={ref}>
      <button
        className={`ctrl-btn device-btn ${active ? "active-device" : ""}`}
        onClick={toggleDropdown}
        aria-label={`Current device: ${activeName}`}
        title={activeName}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 8v-2M12 18v-2M8 12H6M18 12h-2" />
        </svg>
        {active && <span className="device-indicator" />}
      </button>

      {isOpen && (
        <div className="device-dropdown">
          <div className="device-dropdown-header">
            <span>Connect to a device</span>
            <div className="device-header-actions">
              <button
                className={`device-connect-btn ${startingLocalConnect ? "spinning" : ""} ${hasLocalConnect ? "active" : ""}`}
                onClick={handleStartLocalConnect}
                title={hasLocalConnect ? "SPX Connect is active" : "Start SPX Connect on this Mac"}
                disabled={startingLocalConnect || hasLocalConnect}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
              <button
                className={`device-refresh-btn ${scanning ? "spinning" : ""}`}
                onClick={() => onRefreshLocal()}
                title="Scan for devices"
                disabled={scanning}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          </div>

          {displayError && (
            <div className="device-error">
              <span className="error-icon">⚠️</span>
              <span>{displayError}</span>
            </div>
          )}

          {lastTransferUsedFallback.value && (
            <div className="device-fallback-notice">
              <span className="fallback-icon">🎧</span>
              <span>Moved playback to SPX Player on this Mac</span>
            </div>
          )}

          {unifiedDevices.length === 0 && !scanning && (
            <div className="device-empty">
              <div className="device-empty-icon">📡</div>
              <span className="device-empty-title">No devices found</span>
              <span className="device-empty-hint">
                Select SPX Player to play here, or scan for devices on your Wi-Fi.
              </span>
              <button
                className="device-scan-btn"
                onClick={() => onRefreshLocal()}
                disabled={scanning}
              >
                {scanning ? "Scanning..." : "Scan again"}
              </button>
            </div>
          )}

          <div className="device-list">
            {groups.map((group) => (
              <div key={group.key} className="device-category">
                <div className="device-section-header">
                  <span>{group.label}</span>
                </div>
                {group.devices.map((device) => {
                  const isActiveDevice = device.is_active;
                  const isTransferringTo = transferring && transferringToId === device.id;
                  const isDisabled = !device.canTransfer || isTransferringTo;
                  const deviceKey = device.id || device.name;

                  return (
                    <button
                      key={deviceKey}
                      className={`device-item ${isActiveDevice ? "active" : ""} ${
                        isTransferringTo ? "transferring" : ""
                      }`}
                      onClick={() =>
                        !isDisabled && device.id && handleSelectDevice(device.id, (device as any).deviceIp)
                      }
                      disabled={isDisabled}
                    >
                      <span className="device-icon">{getDeviceIcon(device.type || "")}</span>
                      <div className="device-info">
                        <div className="device-name-row">
                          <span className="device-name">{device.name}</span>
                          {isActiveDevice && <span className="device-playing-badge">Active</span>}
                        </div>
                        <div className="device-meta">
                          {isTransferringTo ? (
                            <span className="transfer-status">
                              <span className="transfer-spinner" />
                              Transferring…
                            </span>
                          ) : (
                            <span className="device-type">
                              {device.id === "spx-player" ? "This Mac" : device.type || "Device"}
                            </span>
                          )}
                        </div>
                      </div>
                      {isActiveDevice && !isTransferringTo && <span className="device-active-dot" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {scanning && (
            <div className="device-scanning-indicator">
              <span className="scanning-spinner" />
              <span>Scanning…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(DeviceSelector);
