/**
 * Notification Store
 * 
 * Centralized notification system for SPX.
 * Handles toast notifications, error messages, and status updates.
 */

import { signal, computed } from "@preact/signals";
import { ErrorCategory, AppError, ErrorSeverity, createError } from "../lib/errors";
import type { IconName } from "../components/icons";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Notification {
  id: string;
  type: "error" | "warning" | "info" | "success";
  title: string;
  message: string;
  solution?: string[];
  icon: IconName;
  autoDismiss: boolean;
  dismissTimeout: number;
  requiresAction: boolean;
  timestamp: number;
  category?: ErrorCategory;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";
export type AuthStatus = "authenticated" | "expired" | "unauthenticated";
export type DeviceStatus = "available" | "none" | "error" | "checking";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

// Active notifications
export const notifications = signal<Notification[]>([]);

// Error history (for debugging)
export const errorHistory = signal<AppError[]>([]);

// System status
export const connectionStatus = signal<ConnectionStatus>("disconnected");
export const authStatus = signal<AuthStatus>("unauthenticated");
export const deviceStatus = signal<DeviceStatus>("none");
export const playbackStatus = signal<"playing" | "paused" | "stopped">("stopped");

// System health checks
export const systemHealth = signal<{
  internet: boolean;
  spotifyApi: boolean;
  websocket: boolean;
  lastCheck: number;
}>({
  internet: false,
  spotifyApi: false,
  websocket: false,
  lastCheck: 0,
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════════════════════════════════════

// Active errors only (non-dismissible)
export const activeErrors = computed(() => 
  notifications.value.filter(n => n.type === "error" && !n.autoDismiss)
);

// Active warnings
export const activeWarnings = computed(() =>
  notifications.value.filter(n => n.type === "warning")
);

// Has critical errors
export const hasCriticalError = computed(() => 
  activeErrors.value.length > 0
);

// Notification count by type
export const notificationCounts = computed(() => ({
  error: notifications.value.filter(n => n.type === "error").length,
  warning: notifications.value.filter(n => n.type === "warning").length,
  info: notifications.value.filter(n => n.type === "info").length,
  success: notifications.value.filter(n => n.type === "success").length,
}));

// Overall system status
export const systemStatus = computed(() => {
  if (connectionStatus.value === "disconnected") return "offline";
  if (authStatus.value === "unauthenticated") return "unauthenticated";
  if (authStatus.value === "expired") return "session-expired";
  if (deviceStatus.value === "none") return "no-device";
  if (deviceStatus.value === "error") return "device-error";
  if (playbackStatus.value === "stopped") return "ready";
  return "ready";
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let notificationCounter = 0;

function generateId(): string {
  return `notif_${Date.now()}_${++notificationCounter}`;
}

/**
 * Add a notification
 */
export function addNotification(notification: Omit<Notification, "id" | "timestamp">): string {
  const id = generateId();
  const newNotification: Notification = {
    ...notification,
    id,
    timestamp: Date.now(),
  };
  
  notifications.value = [...notifications.value, newNotification];
  
  // Auto-dismiss if configured
  if (notification.autoDismiss && notification.dismissTimeout > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, notification.dismissTimeout);
  }
  
  return id;
}

/**
 * Dismiss a notification by ID
 */
export function dismissNotification(id: string): void {
  notifications.value = notifications.value.filter(n => n.id !== id);
}

/**
 * Dismiss all notifications
 */
export function dismissAll(): void {
  notifications.value = [];
}

/**
 * Dismiss notifications by type
 */
export function dismissByType(type: Notification["type"]): void {
  notifications.value = notifications.value.filter(n => n.type !== type);
}

/**
 * Dismiss all errors
 */
export function dismissErrors(): void {
  notifications.value = notifications.value.filter(
    n => n.type !== "error" && n.type !== "warning"
  );
}

/**
 * Update a notification (by id)
 */
export function updateNotification(id: string, updates: Partial<Notification>): void {
  notifications.value = notifications.value.map(n => 
    n.id === id ? { ...n, ...updates } : n
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show an error notification
 */
export function showError(
  title: string,
  message: string,
  options?: Partial<Pick<Notification, "solution" | "requiresAction" | "action" | "category">>
): string {
  return addNotification({
    type: "error",
    title,
    message,
    icon: "x",
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    ...options,
  });
}

/**
 * Show a warning notification
 */
export function showWarning(
  title: string,
  message: string,
  options?: Partial<Pick<Notification, "solution" | "autoDismiss" | "dismissTimeout" | "action" | "category">>
): string {
  return addNotification({
    type: "warning",
    title,
    message,
    icon: "alertTriangle",
    autoDismiss: true,
    dismissTimeout: options?.dismissTimeout ?? 5000,
    requiresAction: false,
    ...options,
  });
}

/**
 * Show an info notification
 */
export function showInfo(
  title: string,
  message: string,
  options?: Partial<Pick<Notification, "autoDismiss" | "dismissTimeout" | "action" | "category">>
): string {
  return addNotification({
    type: "info",
    title,
    message,
    icon: "info",
    autoDismiss: true,
    dismissTimeout: options?.dismissTimeout ?? 3000,
    requiresAction: false,
    ...options,
  });
}

/**
 * Show a success notification
 */
export function showSuccess(
  title: string,
  message: string,
  options?: Partial<Pick<Notification, "autoDismiss" | "dismissTimeout" | "action" | "category">>
): string {
  return addNotification({
    type: "success",
    title,
    message,
    icon: "check",
    autoDismiss: true,
    dismissTimeout: options?.dismissTimeout ?? 3000,
    requiresAction: false,
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show an error from AppError
 */
export function showAppError(appError: AppError): string {
  const def = appError.definition;
  
  // Store in history
  errorHistory.value = [appError, ...errorHistory.value.slice(0, 99)];
  
  const type = def.severity === ErrorSeverity.CRITICAL || def.severity === ErrorSeverity.ERROR
    ? "error" as const
    : def.severity === ErrorSeverity.WARNING
    ? "warning" as const
    : "info" as const;
  
  return addNotification({
    type,
    title: def.title,
    message: def.message,
    solution: def.solution,
    icon: def.icon,
    autoDismiss: def.autoDismiss,
    dismissTimeout: def.dismissTimeout,
    requiresAction: def.requiresAction,
    category: appError.category,
  });
}

/**
 * Show error with raw error (for API errors, etc.)
 */
export function showErrorFromRaw(
  rawError: unknown,
  title?: string,
  message?: string,
  category?: ErrorCategory
): string {
  const appError = createError(rawError, category);
  
  // Store in history
  errorHistory.value = [appError, ...errorHistory.value.slice(0, 99)];
  
  return addNotification({
    type: "error",
    title: title || appError.definition.title,
    message: message || appError.definition.message,
    solution: appError.definition.solution,
    icon: appError.definition.icon,
    autoDismiss: false,
    dismissTimeout: 0,
    requiresAction: true,
    category: appError.category,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update connection status
 */
export function setConnectionStatus(status: ConnectionStatus): void {
  const previousStatus = connectionStatus.value;
  connectionStatus.value = status;
  
  if (status === "disconnected" && previousStatus !== "disconnected") {
    showError(
      "Connection Lost",
      "Lost connection to SPX backend. Some features may not work.",
      {
        solution: [
          "Try restarting SPX",
          "Check if port 1424 is blocked",
          "Disable any VPN that might interfere"
        ],
        action: {
          label: "Retry",
          onClick: () => window.location.reload(),
        },
        category: ErrorCategory.NETWORK_WEBSOCKET_FAILED,
      }
    );
  } else if (status === "connected" && previousStatus !== "connected") {
    // Clear stale errors on reconnect
    dismissByType("error");
    showSuccess("Connected", "SPX is back online.");
  }
}

/**
 * Update auth status
 */
export function setAuthStatus(status: AuthStatus): void {
  const previousStatus = authStatus.value;
  authStatus.value = status;
  
  if (status === "expired" && previousStatus !== "expired") {
    showError(
      "Session Expired",
      "Your Spotify session has expired. Please sign in again.",
      {
        solution: [
          "Click 'Sign In' to re-authenticate",
          "Your history and preferences are preserved"
        ],
        category: ErrorCategory.AUTH_TOKEN_EXPIRED,
      }
    );
  } else if (status === "unauthenticated" && previousStatus === "authenticated") {
    showInfo("Signed Out", "You have been signed out of Spotify.");
  }
}

/**
 * Update device status
 */
export function setDeviceStatus(status: DeviceStatus): void {
  deviceStatus.value = status;
}

/**
 * Update playback status
 */
export function setPlaybackStatus(status: "playing" | "paused" | "stopped"): void {
  playbackStatus.value = status;
}

/**
 * Update system health
 */
export function updateSystemHealth(health: Partial<{
  internet: boolean;
  spotifyApi: boolean;
  websocket: boolean;
}>): void {
  systemHealth.value = {
    ...systemHealth.value,
    ...health,
    lastCheck: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALIZED ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle authentication errors
 */
export function handleAuthError(error: unknown): string {
  authStatus.value = "expired";
  const appError = createError(error);
  return showAppError(appError);
}

/**
 * Handle network errors
 */
export function handleNetworkError(error: unknown, context?: string): string {
  const appError = createError(error, undefined, context);
  return showAppError(appError);
}

/**
 * Handle device errors
 */
export function handleDeviceError(error: unknown, context?: string): string {
  deviceStatus.value = "error";
  const appError = createError(error, undefined, context);
  return showAppError(appError);
}

/**
 * Handle playback errors
 */
export function handlePlaybackError(error: unknown, context?: string): string {
  const appError = createError(error, undefined, context);
  return showAppError(appError);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get error summary for debugging
 */
export function getErrorSummary(): {
  total: number;
  byCategory: Record<string, number>;
  recent: AppError[];
} {
  const byCategory: Record<string, number> = {};
  
  errorHistory.value.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  });
  
  return {
    total: errorHistory.value.length,
    byCategory,
    recent: errorHistory.value.slice(0, 10),
  };
}

/**
 * Clear error history
 */
export function clearErrorHistory(): void {
  errorHistory.value = [];
}

/**
 * Export all notifications for debugging
 */
export function exportNotifications(): Notification[] {
  return [...notifications.value];
}
