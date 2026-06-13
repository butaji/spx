import { useEffect, useRef } from "preact/hooks";
import { IconPlay, IconHeart, IconPlus, IconQueue, IconCopy, IconExternal } from "./icons";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: preact.JSX.Element;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      style={{ left: x, top: y }}
    >
      {items.map((item) =>
        item.divider ? (
          <div key={item.id} className="context-menu-divider" />
        ) : (
          <button
            key={item.id}
            className={`context-menu-item ${item.danger ? "danger" : ""} ${item.disabled ? "disabled" : ""}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}

// Helper to create track context menu items
export function createTrackContextMenu(
  onPlay: () => void,
  onAddToQueue: () => void,
  onAddToPlaylist: () => void,
  onLike: () => void,
  onCopyLink: () => void,
  onGoToAlbum: () => void,
  onGoToArtist: () => void,
  isLiked: boolean = false
): ContextMenuItem[] {
  return [
    { id: "play", label: "Play", icon: <IconPlay size={16} />, onClick: onPlay },
    { id: "queue", label: "Add to queue", icon: <IconQueue size={16} />, onClick: onAddToQueue },
    { id: "playlist", label: "Add to playlist", icon: <IconPlus size={16} />, onClick: onAddToPlaylist },
    { id: "like", label: isLiked ? "Unlike" : "Like", icon: <IconHeart size={16} filled={isLiked} />, onClick: onLike },
    { id: "divider1", label: "", onClick: () => {}, divider: true },
    { id: "album", label: "Go to album", icon: <IconExternal size={16} />, onClick: onGoToAlbum },
    { id: "artist", label: "Go to artist", icon: <IconExternal size={16} />, onClick: onGoToArtist },
    { id: "divider2", label: "", onClick: () => {}, divider: true },
    { id: "copy", label: "Copy track link", icon: <IconCopy size={16} />, onClick: onCopyLink },
  ];
}
