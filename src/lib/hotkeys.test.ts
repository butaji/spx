import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('hotkeys', () => {
  // Mock document for node environment
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;
  let eventHandlers: Map<string, EventListener[]>;
  let documentMock: any;

  beforeEach(() => {
    eventHandlers = new Map();
    mockAddEventListener = vi.fn((type: string, handler: EventListener) => {
      if (!eventHandlers.has(type)) eventHandlers.set(type, []);
      eventHandlers.get(type)!.push(handler);
    });
    mockRemoveEventListener = vi.fn((type: string, handler: EventListener) => {
      const handlers = eventHandlers.get(type) || [];
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    });

    documentMock = {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    };

    // @ts-ignore
    global.document = documentMock;

    // Clear module cache to reset module-level state
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getHotkeys() {
    const mod = await import('./hotkeys');
    return mod;
  }

  function dispatchKeydown(key: string, options: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean; target?: any } = {}) {
    const handlers = eventHandlers.get('keydown') || [];
    const event = {
      key,
      code: key,
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      altKey: options.altKey || false,
      metaKey: options.metaKey || false,
      target: options.target || documentMock,
      preventDefault: vi.fn(),
    };
    handlers.forEach(h => h(event as any));
    return event;
  }

  it('setupHotkeys adds exactly one keydown listener', async () => {
    const { setupHotkeys, registerHotkey } = await getHotkeys();
    registerHotkey({ key: 'a', handler: vi.fn(), description: 'Test' });
    setupHotkeys();
    setupHotkeys();

    expect(mockAddEventListener).toHaveBeenCalledTimes(2);
    expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
  });

  it('teardownHotkeys removes the listener', async () => {
    const { setupHotkeys, teardownHotkeys, registerHotkey } = await getHotkeys();
    registerHotkey({ key: 'a', handler: vi.fn(), description: 'Test' });
    setupHotkeys();
    teardownHotkeys();

    expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
  });

  it('registered handler fires on matching keydown', async () => {
    const { setupHotkeys, registerHotkey } = await getHotkeys();
    const handler = vi.fn();
    registerHotkey({ key: 'a', handler, description: 'Test' });
    setupHotkeys();

    dispatchKeydown('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handler does not fire when typing in input', async () => {
    const { setupHotkeys, registerHotkey } = await getHotkeys();
    const handler = vi.fn();
    registerHotkey({ key: 'a', handler, description: 'Test' });
    setupHotkeys();

    const inputTarget = { tagName: 'INPUT' };
    dispatchKeydown('a', { target: inputTarget });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clearHotkeys removes all registered hotkeys', async () => {
    const { setupHotkeys, registerHotkey, clearHotkeys } = await getHotkeys();
    const handler = vi.fn();
    registerHotkey({ key: 'a', handler, description: 'Test' });
    setupHotkeys();
    clearHotkeys();

    dispatchKeydown('a');
    expect(handler).not.toHaveBeenCalled();
  });

  it('modifier keys are respected', async () => {
    const { setupHotkeys, registerHotkey } = await getHotkeys();
    const handler = vi.fn();
    registerHotkey({ key: 'a', modifiers: ['ctrl'], handler, description: 'Ctrl+A' });
    setupHotkeys();

    dispatchKeydown('a');
    expect(handler).not.toHaveBeenCalled();

    dispatchKeydown('a', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('getHotkeyList returns registered hotkeys', async () => {
    const { registerHotkey, getHotkeyList } = await getHotkeys();
    registerHotkey({ key: 'a', handler: vi.fn(), description: 'Test A' });
    registerHotkey({ key: 'b', handler: vi.fn(), description: 'Test B' });
    expect(getHotkeyList().length).toBe(2);
    expect(getHotkeyList()[0].description).toBe('Test A');
  });
});
