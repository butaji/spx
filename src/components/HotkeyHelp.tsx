import { IconX, IconKeyboard } from './icons';

interface HotkeyItem {
  keys: string[];
  description: string;
  category?: string;
}

const HOTKEYS: HotkeyItem[] = [
  // Playback
  { keys: ['Space'], description: 'Play / Pause', category: 'Playback' },
  { keys: ['N'], description: 'Next track', category: 'Playback' },
  { keys: ['P'], description: 'Previous track', category: 'Playback' },
  { keys: ['S'], description: 'Toggle shuffle', category: 'Playback' },
  { keys: ['R'], description: 'Cycle repeat mode', category: 'Playback' },
  { keys: ['←'], description: 'Seek backward', category: 'Playback' },
  { keys: ['→'], description: 'Seek forward', category: 'Playback' },
  
  // Navigation
  { keys: ['H'], description: 'Go to Home', category: 'Navigation' },
  { keys: ['/'], description: 'Focus search', category: 'Navigation' },
  { keys: ['Q'], description: 'Open queue', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close modal / Go back', category: 'Navigation' },
  
  // Volume
  { keys: ['↑'], description: 'Volume up', category: 'Volume' },
  { keys: ['↓'], description: 'Volume down', category: 'Volume' },
  { keys: ['M'], description: 'Toggle mute', category: 'Volume' },
  
  // Other
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Other' },
  { keys: ['L'], description: 'Toggle like', category: 'Other' },
];

// Group hotkeys by category
const groupedHotkeys = HOTKEYS.reduce((acc, hotkey) => {
  const category = hotkey.category || 'Other';
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(hotkey);
  return acc;
}, {} as Record<string, HotkeyItem[]>);

interface HotkeyHelpProps {
  onClose: () => void;
}

export function HotkeyHelp({ onClose }: HotkeyHelpProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="hotkey-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="hotkey-title"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="hotkey-panel" onClick={e => e.stopPropagation()}>
        <div className="hotkey-header">
          <div className="hotkey-title-row">
            <IconKeyboard size={20} />
            <h2 id="hotkey-title">Keyboard Shortcuts</h2>
          </div>
          <button 
            className="hotkey-close-btn" 
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <IconX size={18} />
          </button>
        </div>
        
        <div className="hotkey-content">
          {Object.entries(groupedHotkeys).map(([category, hotkeys]) => (
            <div key={category} className="hotkey-category">
              <h3 className="hotkey-category-title">{category}</h3>
              <div className="hotkey-list">
                {hotkeys.map((hk, i) => (
                  <div key={i} className="hotkey-row">
                    <div className="hotkey-keys">
                      {hk.keys.map((key, j) => (
                        <kbd key={j} className="hotkey-key">{key}</kbd>
                      ))}
                    </div>
                    <span className="hotkey-description">{hk.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="hotkey-footer">
          <span>Press <kbd>?</kbd> anytime to toggle this panel</span>
        </div>
      </div>
    </div>
  );
}
