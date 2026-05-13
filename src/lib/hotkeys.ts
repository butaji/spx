export interface HotkeyConfig {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  handler: () => void;
  description: string;
  scope?: 'global' | 'input';
}

const hotkeys: HotkeyConfig[] = [];

export function registerHotkey(config: HotkeyConfig) {
  hotkeys.push(config);
}

export function setupHotkeys() {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

    const pressed = hotkeys.find(hk => {
      if (hk.key !== e.key && hk.key !== e.code) return false;
      if (hk.modifiers?.includes('ctrl') && !e.ctrlKey) return false;
      if (hk.modifiers?.includes('alt') && !e.altKey) return false;
      if (hk.modifiers?.includes('shift') && !e.shiftKey) return false;
      if (hk.modifiers?.includes('meta') && !e.metaKey) return false;
      return true;
    });

    if (pressed) {
      e.preventDefault();
      pressed.handler();
    }
  });
}

export function getHotkeyList(): HotkeyConfig[] {
  return hotkeys;
}
