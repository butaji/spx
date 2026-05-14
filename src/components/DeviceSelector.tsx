import { useState, useRef, useEffect } from "preact/compat";
import { availableDevices, localDevices, activeDevice, isScanning, isTransferring, allDevices, selectDevice } from "../stores/devices";

interface Props {
  onRefreshLocal: () => void;
}

function getDeviceIcon(type: string) {
  const iconClass = "device-type-icon";
  switch (type?.toLowerCase()) {
    case "computer":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "smartphone":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );
    case "speaker":
    case "cast_audio":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      );
    case "tv":
    case "cast_video":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "avr":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.78-.929l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-3.39 0l-1.32-.377a2.25 2.25 0 01-1.632-2.163v-3.75z" />
          <path d="M19.5 10.5c0 .466-.164.9-.442 1.237l-1.32 1.598a2.25 2.25 0 01-3.336 0l-1.32-1.598A1.875 1.875 0 0112.75 10.5h6.75z" />
        </svg>
      );
  }
}

export default function DeviceSelector({ onRefreshLocal }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active = activeDevice.value;
  const scanning = isScanning.value;
  const transferring = isTransferring.value;
  const unifiedDevices = allDevices.value;

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

  const handleSelectDevice = async (deviceId: string, deviceIp?: string) => {
    if (transferring) return;
    setError(null);
    const success = await selectDevice(deviceId, deviceIp);
    if (!success) {
      setError("Could not connect to device. Make sure it's on the same network.");
    }
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
            <span>{scanning ? "Searching..." : "Connect to a device"}</span>
            <button
              className={`device-refresh-btn ${scanning ? 'spinning' : ''}`}
              onClick={onRefreshLocal}
              title="Scan for local devices"
              disabled={scanning}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          {error && (
            <div className="device-error">{error}</div>
          )}

          {unifiedDevices.length === 0 && !scanning && (
            <div className="device-empty">
              <span className="device-empty-title">No devices found</span>
              <span className="device-empty-hint">
                Make sure Spotify is open on a device and you're on the same network.
              </span>
            </div>
          )}

          <div className="device-list">
            {unifiedDevices.map((device) => {
              const isActiveDevice = device.is_active;
              const isDisabled = !device.canTransfer || transferring;

              return (
                <button
                  key={device.id || device.name}
                  className={`device-item ${isActiveDevice ? "active" : ""} ${transferring && isActiveDevice ? "transferring" : ""}`}
                  onClick={() => !isDisabled && handleSelectDevice(device.id!, (device as any).deviceIp)}
                  disabled={isDisabled}
                >
                  <span className="device-icon">{getDeviceIcon(device.type || "")}</span>
                  <div className="device-info">
                    <div className="device-name">
                      {device.name}
                      {isActiveDevice && <span className="device-playing-badge">Playing</span>}
                    </div>
                    <div className="device-meta">
                      {(device as any).isLocal && (device as any).needsWakeUp && (
                        <span className="device-transfer-wake">Tap to connect</span>
                      )}
                      {(device as any).isLocal && !(device as any).needsWakeUp && !(device as any).canTransfer && (
                        <span className="device-transfer-none">{(device as any).localNote || "Network Device"}</span>
                      )}
                      {(device as any).isLocal && (device as any).canTransfer && !(device as any).needsWakeUp && (
                        <span className="device-transfer-ok">Spotify Connect</span>
                      )}
                      {!device.is_active && device.is_restricted && (
                        <span className="device-transfer-none">Restricted</span>
                      )}
                    </div>
                  </div>
                  {isActiveDevice && (
                    <span className="device-active-dot" />
                  )}
                  {transferring && isActiveDevice && (
                    <span className="device-transferring-spinner" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}