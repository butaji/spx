import type { View } from "../App";
import {
  IconHome,
  IconSearch,
  IconLibrary,
  IconQueue,
  IconChart,
} from "./icons";

interface SidebarProps {
  view: View;
  history: View[];
  setHistory: (update: View[] | ((prev: View[]) => View[])) => void;
  user: { name: string; image?: string } | null;
}

const navItems: { view: View; label: string; icon: (active: boolean) => preact.JSX.Element }[] = [
  { view: { type: "home" }, label: "Now Playing", icon: (active) => <IconHome active={active} /> },
  { view: { type: "search" }, label: "Search", icon: () => <IconSearch /> },
  { view: { type: "library", tab: "playlists" }, label: "Library", icon: () => <IconLibrary /> },
  { view: { type: "queue" }, label: "Queue", icon: () => <IconQueue /> },
  { view: { type: "stats" }, label: "Stats", icon: () => <IconChart /> },
];

export function Sidebar({ view, history, setHistory, user }: SidebarProps) {
  const handleNavClick = (itemView: View) => {
    if (view.type !== itemView.type) {
      setHistory([itemView]);
    }
  };

  return (
    <nav className="sidebar">
      {navItems.map((item) => {
        const active = view.type === item.view.type;
        return (
          <button
            key={item.label}
            className={active ? "sidebar-btn active" : "sidebar-btn"}
            onClick={() => handleNavClick(item.view)}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            {item.icon(active)}
            <span>{item.label}</span>
          </button>
        );
      })}
      {history.length > 2 && (
        <div className="sidebar-breadcrumbs">
          <div className="sidebar-divider" />
          {history.slice(1, -1).map((h, i) => (
            <button
              key={i}
              className="sidebar-btn breadcrumb"
              onClick={() => setHistory(history.slice(0, history.indexOf(h) + 1))}
            >
              <span className="breadcrumb-label">
                {h.type === "playlist" || h.type === "album" || h.type === "artist"
                  ? h.name
                  : h.type}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-divider" />
      <div className="sidebar-footer">
        {user && (
          <div className="user-pill">
            {user.image ? (
              <img src={user.image} alt="" />
            ) : (
              <div className="user-pill-avatar">{user.name.charAt(0).toUpperCase()}</div>
            )}
            <span className="user-pill-name">{user.name}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
