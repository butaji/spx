import { getHotkeyList } from '../lib/hotkeys';

export function HotkeyHelp({ onClose }: { onClose: () => void }) {
  const hotkeys = getHotkeyList();

  return (
    <div className="hotkey-overlay" role="dialog" aria-modal="true" aria-labelledby="hotkey-title" onClick={onClose}>
      <div className="hotkey-panel" onClick={e => e.stopPropagation()}>
        <h2 id="hotkey-title">Keyboard Shortcuts</h2>
        <div className="hotkey-list">
          {hotkeys.map((hk, i) => (
            <div key={i} className="hotkey-row">
              <kbd>{formatHotkey(hk)}</kbd>
              <span>{hk.description}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function formatHotkey(hk: { key: string; modifiers?: string[] }) {
  const mods = hk.modifiers?.map((m: string) => m === 'meta' ? '⌘' : m).join('+') || '';
  return mods ? `${mods}+${hk.key}` : hk.key;
}
