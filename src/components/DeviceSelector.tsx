import { useState, useRef, useEffect, useMemo } from "preact/compat";
import { memo, createPortal } from "preact/compat";
import {
  activeDevice,
  isScanning,
  isTransferring,
  allDevices,
  selectDevice,
  selectedDeviceId,
  scanError,
} from "../stores/devices";
import type { SpotifyDevice } from "../types";
import {
  IconMonitor,
  IconVolume,
  IconSpeaker,
  IconMobile,
  IconBolt,
  IconLock,
  IconWifi,
} from "./icons";

interface Props {
  onRefreshLocal: () => void;
}

type TransferStage = "waking" | "starting" | "transferring" | null;

interface DeviceCategory {
  name: string;
  icon: typeof IconMonitor;
}

const DEVICE_CATEGORIES: Record<string, DeviceCategory> = {
  "this-computer": { name: "This computer", icon: IconMonitor },
  "google-cast": { name: "Google Cast", icon: IconMonitor },
  "cast-audio": { name: "Speakers", icon: IconVolume },
  "smart-speaker": { name: "Smart Speakers", icon: IconSpeaker },
  "other": { name: "Other devices", icon: IconMobile },
};

const CATEGORY_ORDER = ["this-computer", "google-cast", "cast-audio", "smart-speaker", "other"];

function categorizeDevice(
  device: SpotifyDevice & { isLocal?: boolean }
): string {
  const type = device.type?.toLowerCase() || "";
  const name = device.name?.toLowerCase() || "";

  if (device.isLocal === false && device.id !== "spx-player") {
    return "this-computer";
  }

  if (
    type.includes("cast_video") ||
    type === "tv" ||
    name.includes("chromecast") ||
    name.includes("nest hub") ||
    name.includes("google tv")
  ) {
    return "google-cast";
  }

  if (
    type.includes("cast_audio") ||
    type === "speaker" ||
    name.includes("home mini") ||
    name.includes("nest mini") ||
    name.includes("google home")
  ) {
    return "cast-audio";
  }

  if (name.includes("sonos") || name.includes("echo") || name.includes("homepod")) {
    return "smart-speaker";
  }

  return "other";
}

function getDeviceIcon(type: string) {
  switch (type?.toLowerCase()) {
    case "computer":
      return <IconMonitor size={20} className="device-type-icon" />;
    case "smartphone":
      return <IconMobile size={20} className="device-type-icon" />;
    case "speaker":
    case "cast_audio":
      return <IconVolume size={20} className="device-type-icon" />;
    case "tv":
    case "cast_video":
      return <IconMonitor size={20} className="device-type-icon" />;
    case "avr":
      return <IconSpeaker size={20} className="device-type-icon" />;
    default:
      return <IconSpeaker size={20} className="device-type-icon" />;
  }
}

function getDeviceHelpInfo(
  device: SpotifyDevice & { isLocal?: boolean; needsWakeUp?: boolean; canTransfer?: boolean }
): { icon: typeof IconBolt; text: string; type: "info" | "warning" | "error" } | null {
  if (device.isLocal && device.needsWakeUp) {
    return { icon: IconBolt, text: "Make sure your device is powered on", type: "info" };
  }
  if (device.is_restricted) {
    return { icon: IconLock, text: "Requires Spotify Premium", type: "error" };
  }
  if (device.isLocal && !device.canTransfer && !device.needsWakeUp) {
    return { icon: IconMobile, text: "Wake this device to control it from SPX", type: "info" };
  }
  return null;
}

function TransferStatus({ stage }: { stage: TransferStage }) {
  if (!stage) return null;

  const config = {
    waking: { text: "Waking device...", className: "transfer-waking" },
    starting: { text: "Starting Spotify...", className: "transfer-starting" },
    transferring: { text: "Transferring...", className: "transfer-transferring" },
  };

  const { text, className } = config[stage];

  return (
    <span className={`transfer-status ${className}`}>
      <IconWifi size={14} className="transfer-icon" />
      <span className="transfer-text">{text}</span>
      <span className="transfer-spinner" />
    </span>
  );
}

function DeviceSelector({ onRefreshLocal }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFade, setErrorFade] = useState(false);
  const [transferStage, setTransferStage] = useState<TransferStage>(null);
  const [dropdownStyle, setDropdownStyle] = useState<Record<string, string | number>>({});
  const ref = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<number | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  const active = activeDevice.value;
  const scanning = isScanning.value;
  const transferring = isTransferring.value;
  const transferringToId = selectedDeviceId.value;
  const unifiedDevices = allDevices.value;
  const deviceScanError = scanError.value;

  const displayError = error || deviceScanError;

  const groupedDevices = useMemo(() => {
    return unifiedDevices.reduce((acc, device) => {
      const category = categorizeDevice(device);
      if (!acc[category]) acc[category] = [];
      acc[category].push(device);
      return acc;
    }, {} as Record<string, typeof unifiedDevices>);
  }, [unifiedDevices]);

  const orderedCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) => groupedDevices[cat]?.length > 0);
  }, [groupedDevices]);

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

  // Create portal container for the dropdown so it can render above all other UI layers.
  useEffect(() => {
    const portal = document.createElement("div");
    portal.className = "device-dropdown-portal";
    document.body.appendChild(portal);
    portalRef.current = portal;
    return () => {
      portal.remove();
      portalRef.current = null;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePortal = portalRef.current?.contains(target) ?? false;
      const insideSelector = ref.current?.contains(target) ?? false;
      if (!insidePortal && !insideSelector) {
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
    setTransferStage("waking");
    const startingTimer = window.setTimeout(() => setTransferStage("starting"), 800);
    const transferringTimer = window.setTimeout(() => setTransferStage("transferring"), 2000);

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

  const updateDropdownPosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      bottom: `${window.innerHeight - rect.top + 8}px`,
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 9999,
    });
  };

  const toggleDropdown = () => {
    setIsOpen((open) => {
      if (!open) {
        updateDropdownPosition();
      }
      return !open;
    });
  };

  // Keep dropdown aligned with the button when the window is resized or scrolled.
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const onResize = () => updateDropdownPosition();
    const onScroll = () => updateDropdownPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen]);

  const dropdownContent = isOpen ? (
    <div className="device-dropdown" style={dropdownStyle}>
      <div className="device-dropdown-header">
        <span>
          {scanning && unifiedDevices.length === 0
            ? "Searching for devices..."
            : "Connect to a device"}
        </span>
        <button
          className={`device-refresh-btn ${scanning ? "spinning" : ""}`}
          onClick={() => onRefreshLocal()}
          title="Scan for local devices"
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

      {displayError && (
        <div className={`device-error ${errorFade ? "fading" : ""}`}>
          <span className="error-icon">⚠️</span>
          <span>{displayError}</span>
        </div>
      )}

      {unifiedDevices.length === 0 && !scanning && (
        <div className="device-empty">
          <div className="device-empty-icon">📡</div>
          <span className="device-empty-title">No devices found</span>
          <span className="device-empty-hint">
            Select SPX Player to play on this Mac, or make sure other devices are on the same Wi-Fi network.
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
        {orderedCategories.map((category) => {
          const CatIcon = DEVICE_CATEGORIES[category]?.icon;
          return (
            <div key={category} className="device-category">
              <div className="device-section-header">
                {CatIcon && <CatIcon size={16} className="category-icon" />}
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
                    className={`device-item ${isActiveDevice ? "active" : ""} ${
                      isTransferringTo ? "transferring" : ""
                    }`}
                    onClick={() =>
                      !isDisabled && handleSelectDevice(device.id!, (device as any).deviceIp)
                    }
                    disabled={isDisabled}
                  >
                    <span className="device-icon">{getDeviceIcon(device.type || "")}</span>
                    <div className="device-info">
                      <div className="device-name-row">
                        <span className="device-name">{device.name}</span>
                        {isActiveDevice && <span className="device-playing-badge">Playing</span>}
                      </div>

                      <div className="device-meta">
                        {isTransferringTo ? (
                          <TransferStatus stage={transferStage} />
                        ) : (
                          <>
                            {!(device as any).isLocal && (
                              <span className="device-tag spotify-connect">Spotify Connect</span>
                            )}
                            {(device as any).isLocal && (device as any).needsWakeUp && (
                              <span className="device-tag cast-device">Cast device</span>
                            )}
                            {(device as any).isLocal &&
                              (device as any).canTransfer &&
                              !(device as any).needsWakeUp && (
                                <span className="device-tag spotify-connect">Spotify Connect</span>
                              )}
                            {!device.is_active && device.is_restricted && (
                              <span className="device-tag restricted">Restricted</span>
                            )}
                          </>
                        )}
                      </div>

                      {helpInfo && (
                        <div className={`device-help-hint hint-${helpInfo.type}`}>
                          <helpInfo.icon size={14} className="help-icon" />
                          <span>{helpInfo.text}</span>
                        </div>
                      )}
                    </div>

                    {isActiveDevice && !isTransferringTo && <span className="device-active-dot" />}
                    {isTransferringTo && <span className="device-transferring-spinner" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {scanning && unifiedDevices.length > 0 && (
        <div className="device-scanning-indicator">
          <span className="scanning-spinner" />
          <span>Scanning for more devices...</span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="device-selector" ref={ref}>
      <button
        className={`ctrl-btn device-btn ${active ? "active-device" : ""}`}
        onClick={toggleDropdown}
        aria-label="Select playback device"
        title={active?.name || "Select device"}
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

      {portalRef.current && dropdownContent
        ? createPortal(dropdownContent, portalRef.current)
        : dropdownContent}
    </div>
  );
}

export default memo(DeviceSelector);
