/**
 * Comprehensive Error Handling System for SPX
 * 
 * This module provides:
 * - Complete error categorization covering ALL failure modes
 * - User-friendly messages with actionable solutions
 * - Diagnostic utilities to identify issues proactively
 * - Integration with notification system
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CATEGORIES - Complete coverage of all failure modes
// ═══════════════════════════════════════════════════════════════════════════════

export enum ErrorCategory {
  // ════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION & SESSIONS
  // ════════════════════════════════════════════════════════════════════════════
  AUTH_NOT_INSTALLED = "AUTH_NOT_INSTALLED",           // App not properly installed
  AUTH_NO_CREDENTIALS = "AUTH_NO_CREDENTIALS",       // Missing Spotify Client ID
  AUTH_OAUTH_FAILED = "AUTH_OAUTH_FAILED",             // OAuth flow failed
  AUTH_NOT_AUTHENTICATED = "AUTH_NOT_AUTHENTICATED",   // Not logged in
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",           // Session expired
  AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",           // Token corrupted
  AUTH_PREMIUM_REQUIRED = "AUTH_PREMIUM_REQUIRED",    // Premium account needed
  AUTH_SPOTIFY_APP_CLOSED = "AUTH_SPOTIFY_APP_CLOSED", // Spotify app closed (librespot)
  AUTH_PERMISSION_DENIED = "AUTH_PERMISSION_DENIED",   // Browser/app permissions
  
  // ════════════════════════════════════════════════════════════════════════════
  // NETWORK & CONNECTIVITY  
  // ════════════════════════════════════════════════════════════════════════════
  NETWORK_NO_CONNECTION = "NETWORK_NO_CONNECTION",     // No internet
  NETWORK_WIFI_DISCONNECTED = "NETWORK_WIFI_DISCONNECTED", // WiFi disconnected
  NETWORK_SLOW = "NETWORK_SLOW",                       // Slow/unstable connection
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",                 // Request timed out
  NETWORK_WEBSOCKET_FAILED = "NETWORK_WEBSOCKET_FAILED", // WS connection lost
  NETWORK_WEBSOCKET_PORT = "NETWORK_WEBSOCKET_PORT",   // Port 1424 blocked
  NETWORK_DNS_FAILED = "NETWORK_DNS_FAILED",           // DNS resolution failed
  NETWORK_PROXY_BLOCKED = "NETWORK_PROXY_BLOCKED",     // Proxy/VPN blocking
  NETWORK_RATE_LIMITED = "NETWORK_RATE_LIMITED",       // Too many requests
  NETWORK_SERVER_ERROR = "NETWORK_SERVER_ERROR",       // Spotify server issues
  NETWORK_SERVER_DOWN = "NETWORK_SERVER_DOWN",         // Spotify down
  NETWORK_CORS_BLOCKED = "NETWORK_CORS_BLOCKED",       // CORS policy blocked
  
  // ════════════════════════════════════════════════════════════════════════════
  // DEVICES
  // ════════════════════════════════════════════════════════════════════════════
  DEVICE_NO_DEVICES = "DEVICE_NO_DEVICES",             // No Spotify devices found
  DEVICE_NO_ACTIVE = "DEVICE_NO_ACTIVE",               // No active playback device
  DEVICE_SPOTIFY_CLOSED = "DEVICE_SPOTIFY_CLOSED",     // Spotify app not running
  DEVICE_DIFFERENT_WIFI = "DEVICE_DIFFERENT_WIFI",    // Device on different network
  DEVICE_NOT_SUPPORTED = "DEVICE_NOT_SUPPORTED",       // Device type not supported
  DEVICE_PREMIUM_MISMATCH = "DEVICE_PREMIUM_MISMATCH", // Premium mismatch
  DEVICE_CAST_NOT_FOUND = "DEVICE_CAST_NOT_FOUND",     // Cast device not found
  DEVICE_CAST_OFFLINE = "DEVICE_CAST_OFFLINE",         // Cast device offline
  DEVICE_CAST_AUTH_FAILED = "DEVICE_CAST_AUTH_FAILED", // Cast auth failed
  DEVICE_LOCAL_SCAN_FAILED = "DEVICE_LOCAL_SCAN_FAILED", // Device scan failed
  
  // ════════════════════════════════════════════════════════════════════════════
  // PLAYBACK
  // ════════════════════════════════════════════════════════════════════════════
  PLAYBACK_NO_TRACK = "PLAYBACK_NO_TRACK",             // Nothing playing
  PLAYBACK_FAILED = "PLAYBACK_FAILED",                 // Playback control failed
  PLAYBACK_API_ERROR = "PLAYBACK_API_ERROR",           // Spotify API playback error
  PLAYBACK_NOT_PREMIUM = "PLAYBACK_NOT_PREMIUM",      // Non-premium playback attempt
  PLAYBACK_REGION_BLOCKED = "PLAYBACK_REGION_BLOCKED", // Track not available
  PLAYBACK_EXPLICIT_BLOCKED = "PLAYBACK_EXPLICIT_BLOCKED", // Explicit content blocked
  PLAYBACK_LOCAL_ONLY = "PLAYBACK_LOCAL_ONLY",         // Local files can't be remote-controlled
  PLAYBACK_AD_PLAYING = "PLAYBACK_AD_PLAYING",         // Ad is playing (can't control)
  PLAYBACK_CONTEXT_CHANGED = "PLAYBACK_CONTEXT_CHANGED", // Playback context changed unexpectedly
  PLAYBACK_QUEUE_EMPTY = "PLAYBACK_QUEUE_EMPTY",       // Queue is empty
  
  // ════════════════════════════════════════════════════════════════════════════
  // CONTENT & SEARCH
  // ════════════════════════════════════════════════════════════════════════════
  CONTENT_NOT_FOUND = "CONTENT_NOT_FOUND",             // Track/playlist not found
  CONTENT_UNAVAILABLE = "CONTENT_UNAVAILABLE",        // Content unavailable in region
  CONTENT_EXPLICIT = "CONTENT_EXPLICIT",              // Explicit content filter
  CONTENT_RESTRICTED = "CONTENT_RESTRICTED",           // Content restricted
  SEARCH_FAILED = "SEARCH_FAILED",                     // Search API failed
  SEARCH_NO_RESULTS = "SEARCH_NO_RESULTS",             // No search results
  
  // ════════════════════════════════════════════════════════════════════════════
  // SYSTEM & PERMISSIONS
  // ════════════════════════════════════════════════════════════════════════════
  SYSTEM_PORT_CONFLICT = "SYSTEM_PORT_CONFLICT",       // Port 1424 in use
  SYSTEM_PERMISSION_DENIED = "SYSTEM_PERMISSION_DENIED", // Permission denied
  SYSTEM_LOCAL_NETWORK = "SYSTEM_LOCAL_NETWORK",      // Local network access needed
  SYSTEM_MICROPHONE = "SYSTEM_MICROPHONE",            // Mic permission for voice
  SYSTEM_NOTARIZATION = "SYSTEM_NOTARIZATION",        // App not verified
  SYSTEM_BACKEND_CRASHED = "SYSTEM_BACKEND_CRASHED",  // Rust backend crashed
  SYSTEM_BACKEND_TIMEOUT = "SYSTEM_BACKEND_TIMEOUT",  // Backend not responding
  SYSTEM_UNSUPPORTED_OS = "SYSTEM_UNSUPPORTED_OS",    // OS not supported
  SYSTEM_VERSION_OLD = "SYSTEM_VERSION_OLD",          // App needs update
  SYSTEM_STORAGE_FULL = "SYSTEM_STORAGE_FULL",       // Storage full
  
  // ════════════════════════════════════════════════════════════════════════════
  // LIBRARY & SYNC
  // ════════════════════════════════════════════════════════════════════════════
  LIBRARY_SYNC_FAILED = "LIBRARY_SYNC_FAILED",         // Library sync failed
  LIBRARY_LIKED_FAILED = "LIBRARY_LIKED_FAILED",      // Liked songs API failed
  LIBRARY_PLAYLIST_FAILED = "LIBRARY_PLAYLIST_FAILED", // Playlist operation failed
  LIBRARY_FOLLOW_FAILED = "LIBRARY_FOLLOW_FAILED",     // Follow/unfollow failed
  
  // ════════════════════════════════════════════════════════════════════════════
  // UNKNOWN / INTERNAL
  // ════════════════════════════════════════════════════════════════════════════
  UNKNOWN = "UNKNOWN",                                 // Unknown error
  INTERNAL_ERROR = "INTERNAL_ERROR",                  // Internal app error
  COMMAND_FAILED = "COMMAND_FAILED",                   // Generic command failed
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR SEVERITY
// ═══════════════════════════════════════════════════════════════════════════════

export enum ErrorSeverity {
  CRITICAL = "critical",  // Red - App unusable, requires immediate action
  ERROR = "error",       // Red - Major feature broken
  WARNING = "warning",    // Yellow - Potential issue, user should know
  INFO = "info",          // Blue - Informational
  SUCCESS = "success",    // Green - Positive feedback
  DEBUG = "debug",        // Gray - Debug info (hidden from user)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR DEFINITIONS - Complete mapping with user-friendly messages
// ═══════════════════════════════════════════════════════════════════════════════

import type { IconName } from "../components/icons";

export interface ErrorDefinition {
  code: ErrorCategory;
  title: string;
  message: string;
  solution: string[];
  severity: ErrorSeverity;
  autoDismiss: boolean;
  dismissTimeout: number;
  requiresAction: boolean;
  isRetryable: boolean;
  icon: IconName;
}

export const ERROR_DEFINITIONS: Record<ErrorCategory, ErrorDefinition> = {
  // ─── AUTHENTICATION ──────────────────────────────────────────────────────────
  
  [ErrorCategory.AUTH_NOT_INSTALLED]: {
    code: ErrorCategory.AUTH_NOT_INSTALLED,
    title: "App Not Installed Properly",
    message: "SPX is running in browser mode, but it needs to be installed as a desktop app for full functionality.",
    solution: [
      "Download SPX from the releases page",
      "Install the app and run it again",
      "Browser mode has limited features"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "settings"
  },
  
  [ErrorCategory.AUTH_NO_CREDENTIALS]: {
    code: ErrorCategory.AUTH_NO_CREDENTIALS,
    title: "Spotify App Not Configured",
    message: "SPX requires a Spotify Client ID to connect. This is configured during installation.",
    solution: [
      "Create a Spotify Developer App at developer.spotify.com",
      "Set the SPOTIFY_CLIENT_ID in your environment",
      "Or reinstall SPX with proper configuration"
    ],
    severity: ErrorSeverity.CRITICAL,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "key"
  },
  
  [ErrorCategory.AUTH_OAUTH_FAILED]: {
    code: ErrorCategory.AUTH_OAUTH_FAILED,
    title: "Sign In Failed",
    message: "SPX couldn't complete the Spotify sign-in. The browser popup may have been blocked.",
    solution: [
      "Allow popups for this website in your browser",
      "Try signing in again",
      "Make sure Spotify.com is accessible"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "lock"
  },
  
  [ErrorCategory.AUTH_NOT_AUTHENTICATED]: {
    code: ErrorCategory.AUTH_NOT_AUTHENTICATED,
    title: "Not Signed In",
    message: "You need to sign in to Spotify to use SPX. A Spotify Premium account is required for playback control.",
    solution: [
      "Click 'Connect to Spotify' or 'Sign In'",
      "Authorize SPX in the browser popup",
      "Premium accounts are required for playback"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "key"
  },
  
  [ErrorCategory.AUTH_TOKEN_EXPIRED]: {
    code: ErrorCategory.AUTH_TOKEN_EXPIRED,
    title: "Session Expired",
    message: "Your Spotify session has expired. Please sign in again to continue using SPX.",
    solution: [
      "Click 'Sign In' to re-authenticate",
      "Complete the authorization in the browser popup",
      "Your history and preferences are preserved"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "lock"
  },
  
  [ErrorCategory.AUTH_TOKEN_INVALID]: {
    code: ErrorCategory.AUTH_TOKEN_INVALID,
    title: "Session Corrupted",
    message: "Your authentication data is invalid. This can happen after app updates.",
    solution: [
      "Close SPX completely (Cmd+Q)",
      "Restart SPX",
      "Sign in again if prompted"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "lock"
  },
  
  [ErrorCategory.AUTH_PREMIUM_REQUIRED]: {
    code: ErrorCategory.AUTH_PREMIUM_REQUIRED,
    title: "Premium Account Required",
    message: "Spotify Premium is required to control playback. Free accounts can browse but not control.",
    solution: [
      "Upgrade to Spotify Premium at spotify.com",
      "SPX requires Premium for playback control"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "diamond"
  },
  
  [ErrorCategory.AUTH_SPOTIFY_APP_CLOSED]: {
    code: ErrorCategory.AUTH_SPOTIFY_APP_CLOSED,
    title: "SPX Player Not Ready",
    message: "SPX's built-in player isn't ready yet. It may still be connecting.",
    solution: [
      "Wait a moment for the SPX Player to connect",
      "Select the SPX Player from the device menu",
      "Or use a different device as the active player"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 10000,
    requiresAction: false,
    isRetryable: true,
    icon: "music"
  },
  
  [ErrorCategory.AUTH_PERMISSION_DENIED]: {
    code: ErrorCategory.AUTH_PERMISSION_DENIED,
    title: "Permission Denied",
    message: "SPX was denied access. This might be due to browser restrictions or privacy settings.",
    solution: [
      "Check browser permissions for this site",
      "Try a different browser",
      "Make sure cookies are enabled"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "ban"
  },
  
  // ─── NETWORK ─────────────────────────────────────────────────────────────────
  
  [ErrorCategory.NETWORK_NO_CONNECTION]: {
    code: ErrorCategory.NETWORK_NO_CONNECTION,
    title: "No Internet Connection",
    message: "SPX can't connect to the internet. All features require an active connection.",
    solution: [
      "Check your Wi-Fi or Ethernet connection",
      "Make sure Airplane Mode is off",
      "Try loading any webpage to verify"
    ],
    severity: ErrorSeverity.CRITICAL,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "wifi"
  },
  
  [ErrorCategory.NETWORK_WIFI_DISCONNECTED]: {
    code: ErrorCategory.NETWORK_WIFI_DISCONNECTED,
    title: "Wi-Fi Disconnected",
    message: "Your device is no longer connected to Wi-Fi. Some local features may not work.",
    solution: [
      "Reconnect to your Wi-Fi network",
      "Check if your router is working",
      "Mobile devices may have switched to data"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "wifi"
  },
  
  [ErrorCategory.NETWORK_SLOW]: {
    code: ErrorCategory.NETWORK_SLOW,
    title: "Slow Connection",
    message: "Your internet connection is slow or unstable. Some features may be delayed.",
    solution: [
      "Try moving closer to your router",
      "Check if other devices are streaming heavily",
      "Consider switching to a faster network"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 10000,
    requiresAction: false,
    isRetryable: true,
    icon: "turtle"
  },
  
  [ErrorCategory.NETWORK_TIMEOUT]: {
    code: ErrorCategory.NETWORK_TIMEOUT,
    title: "Request Timeout",
    message: "Spotify's servers took too long to respond. This is usually temporary.",
    solution: [
      "Wait a moment and try again",
      "Check Spotify's status at downdetector.com",
      "Your internet might be slow"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 8000,
    requiresAction: false,
    isRetryable: true,
    icon: "clock"
  },
  
  [ErrorCategory.NETWORK_WEBSOCKET_FAILED]: {
    code: ErrorCategory.NETWORK_WEBSOCKET_FAILED,
    title: "Connection Lost",
    message: "SPX lost connection to its backend service. Some features may be unavailable.",
    solution: [
      "Try restarting SPX",
      "Check if port 1424 is blocked by firewall",
      "Disable any VPN that might interfere"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "bolt"
  },
  
  [ErrorCategory.NETWORK_WEBSOCKET_PORT]: {
    code: ErrorCategory.NETWORK_WEBSOCKET_PORT,
    title: "Port Blocked",
    message: "SPX's backend port (1424) is blocked. This is needed for real-time updates.",
    solution: [
      "Check your firewall settings",
      "Allow port 1424 for SPX",
      "Some VPN configurations block local ports"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "door"
  },
  
  [ErrorCategory.NETWORK_DNS_FAILED]: {
    code: ErrorCategory.NETWORK_DNS_FAILED,
    title: "DNS Error",
    message: "SPX couldn't resolve Spotify's server address. DNS settings may be incorrect.",
    solution: [
      "Try loading spotify.com in your browser",
      "Flush your DNS cache (sudo dscacheutil -flushcache)",
      "Check custom DNS settings"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "globe"
  },
  
  [ErrorCategory.NETWORK_PROXY_BLOCKED]: {
    code: ErrorCategory.NETWORK_PROXY_BLOCKED,
    title: "Proxy or VPN Blocking",
    message: "Your proxy or VPN is blocking Spotify's connection. This can cause authentication issues.",
    solution: [
      "Try disabling your VPN temporarily",
      "Check proxy settings in System Preferences",
      "Corporate networks may block Spotify"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "lock"
  },
  
  [ErrorCategory.NETWORK_RATE_LIMITED]: {
    code: ErrorCategory.NETWORK_RATE_LIMITED,
    title: "Too Many Requests",
    message: "SPX is making too many requests to Spotify. Please slow down.",
    solution: [
      "Reduce refresh frequency",
      "Wait 30 seconds before trying again",
      "Spotify's rate limits are temporary"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "bolt"
  },
  
  [ErrorCategory.NETWORK_SERVER_ERROR]: {
    code: ErrorCategory.NETWORK_SERVER_ERROR,
    title: "Spotify Server Error",
    message: "Spotify's servers returned an error. This is usually temporary.",
    solution: [
      "Check Spotify status at downdetector.com",
      "Try again in a few minutes",
      "Your account is likely fine"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 10000,
    requiresAction: false,
    isRetryable: true,
    icon: "wrench"
  },
  
  [ErrorCategory.NETWORK_SERVER_DOWN]: {
    code: ErrorCategory.NETWORK_SERVER_DOWN,
    title: "Spotify is Down",
    message: "Spotify's servers appear to be experiencing issues worldwide.",
    solution: [
      "Check status at downdetector.com",
      "Check @SpotifyStatus on Twitter",
      "Wait for Spotify to resolve the issue"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 30000,
    requiresAction: false,
    isRetryable: true,
    icon: "wifiOff"
  },
  
  [ErrorCategory.NETWORK_CORS_BLOCKED]: {
    code: ErrorCategory.NETWORK_CORS_BLOCKED,
    title: "Browser Security Blocked",
    message: "The browser blocked a request to Spotify. This shouldn't happen in the app.",
    solution: [
      "Try running SPX as a desktop app",
      "Clear browser cache and cookies",
      "Try a different browser"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "lock"
  },
  
  // ─── DEVICES ─────────────────────────────────────────────────────────────────
  
  [ErrorCategory.DEVICE_NO_DEVICES]: {
    code: ErrorCategory.DEVICE_NO_DEVICES,
    title: "No Devices Found",
    message: "SPX couldn't find any playback devices. You can always play through the built-in SPX Player on this Mac.",
    solution: [
      "Select SPX Player from the device menu to play on this Mac",
      "If you want another speaker, make sure it's on the same Wi-Fi network",
      "Use the refresh button in the device menu to scan again"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "mobile"
  },
  
  [ErrorCategory.DEVICE_NO_ACTIVE]: {
    code: ErrorCategory.DEVICE_NO_ACTIVE,
    title: "No Active Device",
    message: "There's no active playback device. Select SPX Player or another device and start playing.",
    solution: [
      "Select SPX Player from the device menu to play on this Mac",
      "Or choose another available device",
      "SPX will activate the selected device automatically"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "music"
  },
  
  [ErrorCategory.DEVICE_SPOTIFY_CLOSED]: {
    code: ErrorCategory.DEVICE_SPOTIFY_CLOSED,
    title: "Playback Device Not Active",
    message: "The active playback device is no longer responding. Switch to the SPX Player or another device.",
    solution: [
      "Select SPX Player from the device menu to play on this Mac",
      "Or choose another available device",
      "Make sure the chosen device is on the same network"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "music"
  },
  
  [ErrorCategory.DEVICE_DIFFERENT_WIFI]: {
    code: ErrorCategory.DEVICE_DIFFERENT_WIFI,
    title: "Device on Different Network",
    message: "Your Spotify device is on a different Wi-Fi network than this computer.",
    solution: [
      "Connect your Spotify device to the same Wi-Fi",
      "Or connect this computer to the device's Wi-Fi",
      "AirPlay/Bluetooth devices don't need Wi-Fi"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "wifi"
  },
  
  [ErrorCategory.DEVICE_NOT_SUPPORTED]: {
    code: ErrorCategory.DEVICE_NOT_SUPPORTED,
    title: "Device Not Supported",
    message: "This type of device isn't supported for remote control from SPX.",
    solution: [
      "Try a different device",
      "Some smart speakers have limited API support",
      "Select SPX Player to play on this Mac"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "help"
  },
  
  [ErrorCategory.DEVICE_PREMIUM_MISMATCH]: {
    code: ErrorCategory.DEVICE_PREMIUM_MISMATCH,
    title: "Account Type Mismatch",
    message: "This device is logged into a different Spotify account type (Free vs Premium).",
    solution: [
      "Make sure both use the same Spotify account",
      "Premium account needed for remote control",
      "Select SPX Player to play on this Mac"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "diamond"
  },
  
  [ErrorCategory.DEVICE_CAST_NOT_FOUND]: {
    code: ErrorCategory.DEVICE_CAST_NOT_FOUND,
    title: "Device Not Found",
    message: "The Cast device isn't responding. It might be offline or on a different network.",
    solution: [
      "Make sure the Cast device is powered on",
      "Check it's on the same Wi-Fi network",
      "Try refreshing the device list"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "monitor"
  },
  
  [ErrorCategory.DEVICE_CAST_OFFLINE]: {
    code: ErrorCategory.DEVICE_CAST_OFFLINE,
    title: "Device Offline",
    message: "The Cast device appears to be offline or in sleep mode.",
    solution: [
      "Power cycle the Cast device",
      "Check your network connection",
      "Make sure the device isn't in sleep mode"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "wifiOff"
  },
  
  [ErrorCategory.DEVICE_CAST_AUTH_FAILED]: {
    code: ErrorCategory.DEVICE_CAST_AUTH_FAILED,
    title: "Can't Connect to Device",
    message: "SPX couldn't authenticate with the Cast device. The device may need reconnection.",
    solution: [
      "Make sure the Cast device is powered on",
      "Try disconnecting and reconnecting",
      "Some devices require Spotify Premium"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "monitor"
  },
  
  [ErrorCategory.DEVICE_LOCAL_SCAN_FAILED]: {
    code: ErrorCategory.DEVICE_LOCAL_SCAN_FAILED,
    title: "Device Scan Failed",
    message: "SPX couldn't scan for local network devices. You can still use the SPX Player on this Mac.",
    solution: [
      "Select SPX Player from the device menu to play on this Mac",
      "Grant Local Network access in System Preferences",
      "Try refreshing the device list"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "search"
  },
  
  // ─── PLAYBACK ────────────────────────────────────────────────────────────────
  
  [ErrorCategory.PLAYBACK_NO_TRACK]: {
    code: ErrorCategory.PLAYBACK_NO_TRACK,
    title: "Nothing Playing",
    message: "There's no track currently playing. Select a device and start playback in SPX.",
    solution: [
      "Select SPX Player or another device from the device menu",
      "Select a song in SPX and click play",
      "SPX will activate the device automatically"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "music"
  },
  
  [ErrorCategory.PLAYBACK_FAILED]: {
    code: ErrorCategory.PLAYBACK_FAILED,
    title: "Playback Error",
    message: "SPX couldn't control playback. The active device may have changed or disconnected.",
    solution: [
      "Select SPX Player or another device from the device menu",
      "Try pressing play again",
      "Refresh SPX's playback state"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "music"
  },
  
  [ErrorCategory.PLAYBACK_API_ERROR]: {
    code: ErrorCategory.PLAYBACK_API_ERROR,
    title: "Playback Control Failed",
    message: "SPX couldn't execute your playback request. The action may not be supported.",
    solution: [
      "Some actions require Spotify Premium",
      "Check if the track is available in your region",
      "Try refreshing the playback state"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "music"
  },
  
  [ErrorCategory.PLAYBACK_NOT_PREMIUM]: {
    code: ErrorCategory.PLAYBACK_NOT_PREMIUM,
    title: "Premium Required",
    message: "Playback control requires Spotify Premium. Free accounts can only shuffle play.",
    solution: [
      "Upgrade to Spotify Premium",
      "Browse and queue work without Premium"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "diamond"
  },
  
  [ErrorCategory.PLAYBACK_REGION_BLOCKED]: {
    code: ErrorCategory.PLAYBACK_REGION_BLOCKED,
    title: "Not Available in Your Region",
    message: "This track is not available in your country or region.",
    solution: [
      "Try a different track",
      "Use a VPN to access other regions (if permitted)",
      "This track may be region-restricted by the artist"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "globe"
  },
  
  [ErrorCategory.PLAYBACK_EXPLICIT_BLOCKED]: {
    code: ErrorCategory.PLAYBACK_EXPLICIT_BLOCKED,
    title: "Explicit Content Blocked",
    message: "Explicit content filtering is enabled in your Spotify settings.",
    solution: [
      "Disable explicit content filter in Spotify settings",
      "Or play a non-explicit version if available"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "lock"
  },
  
  [ErrorCategory.PLAYBACK_LOCAL_ONLY]: {
    code: ErrorCategory.PLAYBACK_LOCAL_ONLY,
    title: "Local File",
    message: "This is a local file and can't be played through SPX.",
    solution: [
      "Play this file from the device that has it stored",
      "Or choose a track that's available on Spotify"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "file"
  },
  
  [ErrorCategory.PLAYBACK_AD_PLAYING]: {
    code: ErrorCategory.PLAYBACK_AD_PLAYING,
    title: "Ad Playing",
    message: "An advertisement is currently playing. Playback control is unavailable during ads.",
    solution: [
      "Wait for the ad to finish",
      "Or upgrade to Spotify Premium to skip ads"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "volume"
  },
  
  [ErrorCategory.PLAYBACK_CONTEXT_CHANGED]: {
    code: ErrorCategory.PLAYBACK_CONTEXT_CHANGED,
    title: "Playback Changed",
    message: "The playback context changed unexpectedly. This can happen if someone else took control.",
    solution: [
      "The track list or device may have changed",
      "Check the current playback state",
      "This is normal if sharing devices"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "refresh"
  },
  
  [ErrorCategory.PLAYBACK_QUEUE_EMPTY]: {
    code: ErrorCategory.PLAYBACK_QUEUE_EMPTY,
    title: "Queue is Empty",
    message: "The playback queue is empty. Add some songs to get started.",
    solution: [
      "Search for songs and add them to the queue",
      "Play a playlist or album instead",
      "Or go to Home and pick something to play"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "listMusic"
  },
  
  // ─── CONTENT & SEARCH ────────────────────────────────────────────────────────
  
  [ErrorCategory.CONTENT_NOT_FOUND]: {
    code: ErrorCategory.CONTENT_NOT_FOUND,
    title: "Content Not Found",
    message: "This track, playlist, or album couldn't be found. It may have been removed.",
    solution: [
      "Try searching for it again",
      "The content may have been removed or made private",
      "Check your Spotify library if it was saved"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "search"
  },
  
  [ErrorCategory.CONTENT_UNAVAILABLE]: {
    code: ErrorCategory.CONTENT_UNAVAILABLE,
    title: "Content Unavailable",
    message: "This content is not available in your region or for your account type.",
    solution: [
      "Try a different track or playlist",
      "Check Spotify's content availability",
      "Some content requires Premium"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "globe"
  },
  
  [ErrorCategory.CONTENT_EXPLICIT]: {
    code: ErrorCategory.CONTENT_EXPLICIT,
    title: "Explicit Content",
    message: "This content contains explicit language and is filtered.",
    solution: [
      "Disable explicit content filtering in your Spotify account settings",
      "Or find an alternative version"
    ],
    severity: ErrorSeverity.DEBUG,
    autoDismiss: true,
    dismissTimeout: 2000,
    requiresAction: false,
    isRetryable: false,
    icon: "lock"
  },
  
  [ErrorCategory.CONTENT_RESTRICTED]: {
    code: ErrorCategory.CONTENT_RESTRICTED,
    title: "Content Restricted",
    message: "This content has age or access restrictions.",
    solution: [
      "Check your account restrictions in your Spotify account settings",
      "Some content requires explicit permission"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "lock"
  },
  
  [ErrorCategory.SEARCH_FAILED]: {
    code: ErrorCategory.SEARCH_FAILED,
    title: "Search Failed",
    message: "SPX couldn't complete your search. This might be a temporary issue.",
    solution: [
      "Try searching again",
      "Check your internet connection",
      "Reduce the length of your search query"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "search"
  },
  
  [ErrorCategory.SEARCH_NO_RESULTS]: {
    code: ErrorCategory.SEARCH_NO_RESULTS,
    title: "No Results Found",
    message: "No songs, albums, or artists matched your search.",
    solution: [
      "Try different keywords",
      "Check the spelling of your search",
      "Search for the artist name instead"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 3000,
    requiresAction: false,
    isRetryable: false,
    icon: "search"
  },
  
  // ─── SYSTEM & PERMISSIONS ───────────────────────────────────────────────────
  
  [ErrorCategory.SYSTEM_PORT_CONFLICT]: {
    code: ErrorCategory.SYSTEM_PORT_CONFLICT,
    title: "Port Already in Use",
    message: "SPX's backend can't start because port 1424 is used by another app.",
    solution: [
      "Close any other SPX windows",
      "Quit apps that might use port 1424",
      "Restart your computer as a last resort"
    ],
    severity: ErrorSeverity.CRITICAL,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "door"
  },
  
  [ErrorCategory.SYSTEM_PERMISSION_DENIED]: {
    code: ErrorCategory.SYSTEM_PERMISSION_DENIED,
    title: "Permission Denied",
    message: "SPX needs additional permissions to function properly.",
    solution: [
      "Go to System Preferences > Privacy & Security",
      "Grant required permissions to SPX",
      "Restart SPX after granting permissions"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "lock"
  },
  
  [ErrorCategory.SYSTEM_LOCAL_NETWORK]: {
    code: ErrorCategory.SYSTEM_LOCAL_NETWORK,
    title: "Local Network Access Needed",
    message: "SPX needs Local Network access to find devices and control playback.",
    solution: [
      "Go to System Preferences > Privacy & Security > Local Network",
      "Enable SPX in the list",
      "Restart SPX after enabling"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "globe"
  },
  
  [ErrorCategory.SYSTEM_MICROPHONE]: {
    code: ErrorCategory.SYSTEM_MICROPHONE,
    title: "Microphone Access Needed",
    message: "SPX needs microphone access for voice commands (if enabled).",
    solution: [
      "Grant microphone permission in System Preferences",
      "Or disable voice commands in settings"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: false,
    icon: "microphone"
  },
  
  [ErrorCategory.SYSTEM_NOTARIZATION]: {
    code: ErrorCategory.SYSTEM_NOTARIZATION,
    title: "App Not Verified",
    message: "SPX hasn't been verified by Apple. Allow it in System Preferences on first run.",
    solution: [
      "Go to System Preferences > Privacy & Security",
      "Click 'Open Anyway' for SPX",
      "This is only needed on first launch"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 15000,
    requiresAction: false,
    isRetryable: false,
    icon: "apple"
  },
  
  [ErrorCategory.SYSTEM_BACKEND_CRASHED]: {
    code: ErrorCategory.SYSTEM_BACKEND_CRASHED,
    title: "App Crashed",
    message: "SPX's backend process crashed. Please restart the app.",
    solution: [
      "Close SPX completely",
      "Restart SPX",
      "If this keeps happening, check for app updates"
    ],
    severity: ErrorSeverity.CRITICAL,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "boom"
  },
  
  [ErrorCategory.SYSTEM_BACKEND_TIMEOUT]: {
    code: ErrorCategory.SYSTEM_BACKEND_TIMEOUT,
    title: "App Not Responding",
    message: "SPX's backend is not responding. It may be stuck or overloaded.",
    solution: [
      "Wait a moment for it to recover",
      "If persistent, restart SPX",
      "Try closing other apps to free memory"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: true,
    icon: "clock"
  },
  
  [ErrorCategory.SYSTEM_UNSUPPORTED_OS]: {
    code: ErrorCategory.SYSTEM_UNSUPPORTED_OS,
    title: "Unsupported Operating System",
    message: "SPX requires macOS. This operating system is not supported.",
    solution: [
      "SPX works best on macOS",
      "Check for a version for your OS",
      "Some features may work in a browser"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "monitor"
  },
  
  [ErrorCategory.SYSTEM_VERSION_OLD]: {
    code: ErrorCategory.SYSTEM_VERSION_OLD,
    title: "Update Available",
    message: "A newer version of SPX is available. Updates include bug fixes and new features.",
    solution: [
      "Download the latest version from the releases page",
      "Or run the update command",
      "Consider enabling auto-updates"
    ],
    severity: ErrorSeverity.INFO,
    autoDismiss: true,
    dismissTimeout: 10000,
    requiresAction: false,
    isRetryable: false,
    icon: "refresh"
  },
  
  [ErrorCategory.SYSTEM_STORAGE_FULL]: {
    code: ErrorCategory.SYSTEM_STORAGE_FULL,
    title: "Storage Full",
    message: "Your device is running low on storage. This can affect app performance.",
    solution: [
      "Free up disk space",
      "Clear caches and temporary files",
      "Consider expanding storage"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    isRetryable: false,
    icon: "hardDrive"
  },
  
  // ─── LIBRARY & SYNC ─────────────────────────────────────────────────────────
  
  [ErrorCategory.LIBRARY_SYNC_FAILED]: {
    code: ErrorCategory.LIBRARY_SYNC_FAILED,
    title: "Library Sync Failed",
    message: "SPX couldn't sync your Spotify library. Your saved songs may be outdated.",
    solution: [
      "Try refreshing the library",
      "Check your internet connection",
      "Your saved songs are still safe in your Spotify account"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 8000,
    requiresAction: false,
    isRetryable: true,
    icon: "library"
  },
  
  [ErrorCategory.LIBRARY_LIKED_FAILED]: {
    code: ErrorCategory.LIBRARY_LIKED_FAILED,
    title: "Couldn't Update Liked Song",
    message: "SPX couldn't update the liked status of this song.",
    solution: [
      "Try liking the song again",
      "Check your internet connection",
      "Make sure you're signed in"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "heart"
  },
  
  [ErrorCategory.LIBRARY_PLAYLIST_FAILED]: {
    code: ErrorCategory.LIBRARY_PLAYLIST_FAILED,
    title: "Playlist Operation Failed",
    message: "SPX couldn't update your playlist. This might be a temporary issue.",
    solution: [
      "Try the operation again",
      "Check if you have permission to edit",
      "Make sure the playlist still exists"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "listMusic"
  },
  
  [ErrorCategory.LIBRARY_FOLLOW_FAILED]: {
    code: ErrorCategory.LIBRARY_FOLLOW_FAILED,
    title: "Couldn't Follow/Unfollow",
    message: "SPX couldn't update your follow status for this artist or playlist.",
    solution: [
      "Try the action again",
      "Check your internet connection",
      "Make sure you're signed in"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "user"
  },
  
  // ─── UNKNOWN / INTERNAL ──────────────────────────────────────────────────────
  
  [ErrorCategory.UNKNOWN]: {
    code: ErrorCategory.UNKNOWN,
    title: "Something Went Wrong",
    message: "An unexpected error occurred. This is likely a temporary issue.",
    solution: [
      "Try the action again",
      "Refresh the page or restart SPX",
      "Check the console for more details"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: false,
    isRetryable: true,
    icon: "help"
  },
  
  [ErrorCategory.INTERNAL_ERROR]: {
    code: ErrorCategory.INTERNAL_ERROR,
    title: "Internal Error",
    message: "An internal error occurred in SPX. This shouldn't happen.",
    solution: [
      "Restart SPX",
      "Check for app updates",
      "Report this bug if it persists"
    ],
    severity: ErrorSeverity.ERROR,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: false,
    isRetryable: true,
    icon: "wrench"
  },
  
  [ErrorCategory.COMMAND_FAILED]: {
    code: ErrorCategory.COMMAND_FAILED,
    title: "Command Failed",
    message: "SPX couldn't complete your request. The command was not successful.",
    solution: [
      "Try the action again",
      "Select SPX Player or another device from the device menu",
      "Refresh SPX's state"
    ],
    severity: ErrorSeverity.WARNING,
    autoDismiss: true,
    dismissTimeout: 5000,
    requiresAction: false,
    isRetryable: true,
    icon: "alertTriangle"
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MATCHING - Smart categorization of raw errors
// ═══════════════════════════════════════════════════════════════════════════════

export interface RawError {
  message?: string;
  code?: string | number;
  status?: number;
  statusText?: string;
  name?: string;
}

export function matchError(rawError: unknown): ErrorCategory {
  if (!rawError) return ErrorCategory.UNKNOWN;
  
  const str = String(rawError).toLowerCase();
  const obj = rawError as RawError;
  const status = obj.status || obj.code;
  const msg = (obj.message || "").toLowerCase();
  
  // HTTP Status Codes
  if (typeof status === "number") {
    if (status === 0) return ErrorCategory.NETWORK_NO_CONNECTION;
    if (status === 401) return ErrorCategory.AUTH_TOKEN_EXPIRED;
    if (status === 403) {
      if (msg.includes("premium") || str.includes("premium")) {
        return ErrorCategory.AUTH_PREMIUM_REQUIRED;
      }
      return ErrorCategory.AUTH_PERMISSION_DENIED;
    }
    if (status === 404) return ErrorCategory.CONTENT_NOT_FOUND;
    if (status === 429) return ErrorCategory.NETWORK_RATE_LIMITED;
    if (status === 502 || status === 503 || status === 504) {
      return ErrorCategory.NETWORK_SERVER_ERROR;
    }
  }
  
  // Error Message Patterns
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
    if (msg.includes("failed to fetch") || msg.includes("network error")) {
      return ErrorCategory.NETWORK_NO_CONNECTION;
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return ErrorCategory.NETWORK_TIMEOUT;
    }
    if (msg.includes("websocket")) {
      return ErrorCategory.NETWORK_WEBSOCKET_FAILED;
    }
    if (msg.includes("cors")) {
      return ErrorCategory.NETWORK_CORS_BLOCKED;
    }
    if (msg.includes("dns") || msg.includes("resolve")) {
      return ErrorCategory.NETWORK_DNS_FAILED;
    }
    return ErrorCategory.NETWORK_NO_CONNECTION;
  }
  
  if (msg.includes("auth") || msg.includes("token") || msg.includes("credential")) {
    if (msg.includes("expired") || msg.includes("expir")) {
      return ErrorCategory.AUTH_TOKEN_EXPIRED;
    }
    if (msg.includes("invalid") || msg.includes("corrupt")) {
      return ErrorCategory.AUTH_TOKEN_INVALID;
    }
    if (msg.includes("not authenticated") || msg.includes("unauthorized")) {
      return ErrorCategory.AUTH_NOT_AUTHENTICATED;
    }
    if (msg.includes("oauth") || msg.includes("sign in") || msg.includes("login")) {
      return ErrorCategory.AUTH_OAUTH_FAILED;
    }
    if (msg.includes("premium")) {
      return ErrorCategory.AUTH_PREMIUM_REQUIRED;
    }
    return ErrorCategory.AUTH_NOT_AUTHENTICATED;
  }
  
  if (msg.includes("device") || msg.includes("player")) {
    if (msg.includes("no device") || msg.includes("no active")) {
      return ErrorCategory.DEVICE_NO_ACTIVE;
    }
    if (msg.includes("not found")) {
      return ErrorCategory.DEVICE_NO_DEVICES;
    }
    if (msg.includes("premium")) {
      return ErrorCategory.DEVICE_PREMIUM_MISMATCH;
    }
    if (msg.includes("cast") || msg.includes("chromecast")) {
      return ErrorCategory.DEVICE_CAST_NOT_FOUND;
    }
    return ErrorCategory.DEVICE_NO_ACTIVE;
  }
  
  if (msg.includes("playback") || msg.includes("play") || msg.includes("pause") || msg.includes("track")) {
    if (msg.includes("no track") || msg.includes("nothing playing")) {
      return ErrorCategory.PLAYBACK_NO_TRACK;
    }
    if (msg.includes("ad") || msg.includes("advertisement")) {
      return ErrorCategory.PLAYBACK_AD_PLAYING;
    }
    if (msg.includes("premium") || msg.includes("not premium")) {
      return ErrorCategory.PLAYBACK_NOT_PREMIUM;
    }
    if (msg.includes("region") || msg.includes("unavailable")) {
      return ErrorCategory.PLAYBACK_REGION_BLOCKED;
    }
    if (msg.includes("explicit")) {
      return ErrorCategory.PLAYBACK_EXPLICIT_BLOCKED;
    }
    if (msg.includes("local")) {
      return ErrorCategory.PLAYBACK_LOCAL_ONLY;
    }
    return ErrorCategory.PLAYBACK_FAILED;
  }
  
  if (msg.includes("port") || msg.includes("socket")) {
    if (msg.includes("1424") || msg.includes("address already in use")) {
      return ErrorCategory.SYSTEM_PORT_CONFLICT;
    }
    return ErrorCategory.NETWORK_WEBSOCKET_PORT;
  }
  
  if (msg.includes("permission") || msg.includes("denied") || msg.includes("access")) {
    if (msg.includes("local network") || msg.includes("network access")) {
      return ErrorCategory.SYSTEM_LOCAL_NETWORK;
    }
    return ErrorCategory.SYSTEM_PERMISSION_DENIED;
  }
  
  if (msg.includes("search") || msg.includes("query")) {
    if (msg.includes("no result") || msg.includes("not found")) {
      return ErrorCategory.SEARCH_NO_RESULTS;
    }
    return ErrorCategory.SEARCH_FAILED;
  }
  
  if (msg.includes("rate limit") || msg.includes("too many request")) {
    return ErrorCategory.NETWORK_RATE_LIMITED;
  }
  
  if (msg.includes("server error") || msg.includes("bad gateway")) {
    return ErrorCategory.NETWORK_SERVER_ERROR;
  }
  
  if (msg.includes("proxy") || msg.includes("vpn")) {
    return ErrorCategory.NETWORK_PROXY_BLOCKED;
  }
  
  if (msg.includes("backend") || msg.includes("rust") || msg.includes("invoke")) {
    if (msg.includes("crash") || msg.includes("panic")) {
      return ErrorCategory.SYSTEM_BACKEND_CRASHED;
    }
    return ErrorCategory.SYSTEM_BACKEND_TIMEOUT;
  }
  
  return ErrorCategory.UNKNOWN;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ERROR FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppError {
  id: string;
  category: ErrorCategory;
  definition: ErrorDefinition;
  rawError?: unknown;
  timestamp: number;
  dismissed: boolean;
  context?: string;
}

export function createError(rawError: unknown, category?: ErrorCategory, context?: string): AppError {
  const matchedCategory = category || matchError(rawError);
  const definition = ERROR_DEFINITIONS[matchedCategory];
  
  return {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category: matchedCategory,
    definition,
    rawError,
    timestamp: Date.now(),
    dismissed: false,
    context,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function isAuthError(category: ErrorCategory): boolean {
  return category.startsWith("AUTH_");
}

export function isNetworkError(category: ErrorCategory): boolean {
  return category.startsWith("NETWORK_");
}

export function isDeviceError(category: ErrorCategory): boolean {
  return category.startsWith("DEVICE_");
}

export function isPlaybackError(category: ErrorCategory): boolean {
  return category.startsWith("PLAYBACK_");
}

export function isSystemError(category: ErrorCategory): boolean {
  return category.startsWith("SYSTEM_");
}

export function isCritical(category: ErrorCategory): boolean {
  const def = ERROR_DEFINITIONS[category];
  return def?.severity === ErrorSeverity.CRITICAL || 
         (def?.severity === ErrorSeverity.ERROR && def.requiresAction);
}

export function isRetryable(category: ErrorCategory): boolean {
  return ERROR_DEFINITIONS[category]?.isRetryable ?? true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DiagnosticResult {
  name: string;
  passed: boolean;
  message: string;
  severity: ErrorSeverity;
  errorCategory?: ErrorCategory;
}

/**
 * Check if we're running in Tauri (desktop app)
 */
export function isRunningAsApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Check if the browser has internet connectivity
 */
export async function checkInternetConnection(): Promise<DiagnosticResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    await fetch("https://www.spotify.com/favicon.ico", {
      mode: "no-cors",
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return {
      name: "Internet Connection",
      passed: true,
      message: "Internet connection is available",
      severity: ErrorSeverity.DEBUG,
    };
  } catch {
    return {
      name: "Internet Connection",
      passed: false,
      message: "No internet connection detected",
      severity: ErrorSeverity.CRITICAL,
      errorCategory: ErrorCategory.NETWORK_NO_CONNECTION,
    };
  }
}

/**
 * Check Spotify API availability
 */
export async function checkSpotifyAPI(): Promise<DiagnosticResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch("https://api.spotify.com/v1", {
      method: "HEAD",
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (response.ok || response.status === 401) {
      return {
        name: "Spotify API",
        passed: true,
        message: "Spotify API is reachable",
        severity: ErrorSeverity.DEBUG,
      };
    }
    
    return {
      name: "Spotify API",
      passed: false,
      message: `Spotify API returned status ${response.status}`,
      severity: ErrorSeverity.ERROR,
      errorCategory: ErrorCategory.NETWORK_SERVER_ERROR,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        name: "Spotify API",
        passed: false,
        message: "Spotify API request timed out",
        severity: ErrorSeverity.WARNING,
        errorCategory: ErrorCategory.NETWORK_TIMEOUT,
      };
    }
    return {
      name: "Spotify API",
      passed: false,
      message: "Could not reach Spotify API",
      severity: ErrorSeverity.ERROR,
      errorCategory: ErrorCategory.NETWORK_NO_CONNECTION,
    };
  }
}

/**
 * Check if WebSocket can connect
 */
export function checkWebSocket(): DiagnosticResult {
  if (!isRunningAsApp()) {
    return {
      name: "WebSocket",
      passed: true,
      message: "Running in browser mode (WebSocket not needed)",
      severity: ErrorSeverity.DEBUG,
    };
  }
  
  // This would need to actually try to connect
  // For now, return pending - the actual check happens in ws-client
  return {
    name: "WebSocket",
    passed: true,
    message: "WebSocket connection status unknown (checking...)",
    severity: ErrorSeverity.DEBUG,
  };
}

/**
 * Run all diagnostics
 */
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  
  results.push(checkWebSocket());
  results.push(await checkInternetConnection());
  results.push(await checkSpotifyAPI());
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

import { 
  showError as showNotifError,
  showWarning as showNotifWarning,
  showInfo as showNotifInfo,
  showSuccess as showNotifSuccess,
} from "../stores/notifications";

/**
 * Show error notification from category
 */
export function showError(
  title: string,
  message: string,
  options?: {
    solution?: string[];
    action?: { label: string; onClick: () => void };
  }
): string {
  return showNotifError(title, message, options);
}

/**
 * Show warning notification
 */
export function showWarning(
  message: string,
  title: string = "Warning",
  options?: {
    solution?: string[];
    autoDismiss?: boolean;
    dismissTimeout?: number;
  }
): string {
  return showNotifWarning(title, message, options);
}

/**
 * Show info notification
 */
export function showInfo(
  message: string,
  title: string = "Info",
  options?: {
    autoDismiss?: boolean;
    dismissTimeout?: number;
  }
): string {
  return showNotifInfo(title, message, options);
}

/**
 * Show success notification
 */
export function showSuccess(
  message: string,
  title: string = "Success",
  options?: {
    autoDismiss?: boolean;
    dismissTimeout?: number;
  }
): string {
  return showNotifSuccess(title, message, options);
}

/**
 * Handle error with full integration
 */
export function handleError(error: unknown, context?: string): string {
  const appError = createError(error, undefined, context);
  const def = appError.definition;
  
  console.error(`[SPX Error${context ? ` | ${context}` : ""}]`, {
    category: appError.category,
    title: def.title,
    message: def.message,
    rawError: appError.rawError,
  });
  
  // Add to error history
  try {
    const { errorHistory } = require("../stores/notifications");
    errorHistory.value = [appError, ...errorHistory.value.slice(0, 99)];
  } catch {
    // Ignore if notifications not available
  }
  
  if (def.severity === ErrorSeverity.CRITICAL || def.severity === ErrorSeverity.ERROR) {
    return showError(def.title, def.message, {
      solution: def.solution,
    });
  } else if (def.severity === ErrorSeverity.WARNING) {
    return showWarning(def.title, def.message, {
      solution: def.solution,
      autoDismiss: def.autoDismiss,
      dismissTimeout: def.dismissTimeout,
    });
  } else if (def.severity === ErrorSeverity.INFO) {
    if (def.autoDismiss) {
      showInfo(def.title, def.message, {
        autoDismiss: true,
        dismissTimeout: def.dismissTimeout,
      });
    }
  }
  
  return appError.id;
}
