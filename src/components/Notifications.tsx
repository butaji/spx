/**
 * NotificationBanner Component
 * 
 * Displays toast notifications with error, warning, info, and success messages.
 * Features automatic dismissal, expandable solutions, and action buttons.
 */

import { useState, useEffect } from "preact/hooks";
import { 
  notifications, 
  dismissNotification, 
  dismissAll,
  type Notification 
} from "../stores/notifications";
import { IconMap } from "./icons";
import styles from "./Notifications.module.css";

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const icons = {
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
};

// Icon components for notification types
function NotificationIcon({ type, icon }: { type: Notification["type"]; icon?: string }) {
  // Use the provided icon from the notification, or fallback to type-based icon
  if (icon && icon in IconMap) {
    const IconComponent = IconMap[icon as keyof typeof IconMap];
    return <IconComponent size={24} />;
  }
  
  // Fallback icons based on type
  const fallbackIcons = {
    error: IconMap.x,
    warning: IconMap.alertTriangle,
    info: IconMap.info,
    success: IconMap.check,
  };
  
  const FallbackIcon = fallbackIcons[type];
  return <FallbackIcon size={24} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification }: NotificationItemProps) {
  const [expanded, setExpanded] = useState(notification.requiresAction);
  
  // Auto-collapse non-actionable notifications after a moment
  useEffect(() => {
    if (!notification.requiresAction) {
      const timer = setTimeout(() => setExpanded(false), 100);
      return () => clearTimeout(timer);
    }
  }, [notification.requiresAction]);
  
  return (
    <div 
      class={`${styles.notification} ${styles[notification.type]}`}
      role="alert"
      aria-live="polite"
    >
      <div class={styles.header}>
        <div class={styles.iconWrapper}>
          <NotificationIcon type={notification.type} icon={notification.icon} />
        </div>
        
        <div class={styles.content}>
          <h4 class={styles.title}>{notification.title}</h4>
          <p class={styles.message}>{notification.message}</p>
        </div>
        
        <button 
          class={styles.closeButton}
          onClick={() => dismissNotification(notification.id)}
          aria-label="Dismiss"
        >
          {icons.close}
        </button>
      </div>
      
      {/* Solutions section - shown when expanded */}
      {notification.solution && notification.solution.length > 0 && (
        <div class={styles.solutionsWrapper}>
          <button 
            class={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
          >
            <span>{expanded ? icons.chevronUp : icons.chevronDown}</span>
            <span>{expanded ? "Hide" : "Show"} solutions</span>
          </button>
          
          {expanded && (
            <div class={styles.solutions}>
              <p class={styles.solutionsTitle}>How to fix:</p>
              <ol class={styles.solutionList}>
                {notification.solution.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      
      {/* Action button */}
      {notification.action && (
        <div class={styles.actions}>
          <button 
            class={styles.actionButton}
            onClick={notification.action.onClick}
          >
            {notification.action.label}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CONTAINER
// ═══════════════════════════════════════════════════════════════════════════════

export function Notifications() {
  const activeNotifications = notifications.value;
  
  if (activeNotifications.length === 0) {
    return null;
  }
  
  // Separate critical (non-dismissible) from dismissible
  const critical = activeNotifications.filter(n => n.type === "error" && !n.autoDismiss);
  const dismissible = activeNotifications.filter(n => !(n.type === "error" && !n.autoDismiss));
  
  return (
    <div class={styles.container} role="region" aria-label="Notifications">
      {/* Critical errors - always visible at top */}
      {critical.length > 0 && (
        <div class={styles.criticalSection}>
          {critical.map(notification => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
      
      {/* Dismissible notifications - stack below */}
      {dismissible.length > 0 && (
        <div class={styles.dismissibleSection}>
          {dismissible.map(notification => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
      
      {/* Clear all button when multiple */}
      {activeNotifications.length > 1 && (
        <button 
          class={styles.clearAllButton}
          onClick={dismissAll}
        >
          Clear all notifications
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BAR (minimal connection/status indicator)
// ═══════════════════════════════════════════════════════════════════════════════

import { connectionStatus, authStatus, deviceStatus } from "../stores/notifications";

export function StatusIndicator() {
  const conn = connectionStatus.value;
  const auth = authStatus.value;
  const device = deviceStatus.value;
  
  const getStatusColor = () => {
    if (conn === "disconnected") return "var(--color-error)";
    if (conn === "connecting") return "var(--color-warning)";
    if (auth === "expired") return "var(--color-warning)";
    if (device === "error") return "var(--color-warning)";
    return "var(--color-success)";
  };
  
  const getStatusText = () => {
    if (conn === "disconnected") return "Offline";
    if (conn === "connecting") return "Connecting...";
    if (auth === "expired") return "Session Expired";
    if (auth === "unauthenticated") return "Not Signed In";
    if (device === "none") return "No Device";
    return "Ready";
  };
  
  return (
    <div class={styles.statusIndicator} style={{ color: getStatusColor() }}>
      <span class={styles.statusDot} style={{ backgroundColor: getStatusColor() }} />
      <span class={styles.statusText}>{getStatusText()}</span>
    </div>
  );
}
