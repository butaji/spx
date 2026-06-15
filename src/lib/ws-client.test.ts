import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock WebSocket before importing ws-client
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(_url: string) {
    MockWebSocket.instance = this;
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  });

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }

  static instance: MockWebSocket | null = null;
}

Object.assign(global, { WebSocket: MockWebSocket });

// Import after mock is set up
import {
  connect,
  disconnect,
  send,
  onState,
  isConnected,
} from "./ws-client";

describe("WebSocket Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instance = null;
    disconnect();
  });

  describe("connect()", () => {
    it("should create a WebSocket connection", () => {
      connect();
      expect(MockWebSocket.instance).not.toBeNull();
    });

    it("should not create multiple connections if already connecting", () => {
      connect();
      const first = MockWebSocket.instance;
      connect();
      const second = MockWebSocket.instance;
      expect(first).toBe(second);
    });

    it("should set connected state to true on open", () => {
      connect();
      expect(isConnected()).toBe(false);
      MockWebSocket.instance?.simulateOpen();
      expect(isConnected()).toBe(true);
    });
  });

  describe("disconnect()", () => {
    it("should close WebSocket and reset state", () => {
      connect();
      MockWebSocket.instance?.simulateOpen();
      expect(isConnected()).toBe(true);

      disconnect();
      expect(isConnected()).toBe(false);
    });
  });

  describe("onState()", () => {
    it("should register state callback", () => {
      const callback = vi.fn();
      onState(callback);

      connect();
      MockWebSocket.instance?.simulateOpen();

      MockWebSocket.instance?.simulateMessage({
        action: "playback_update",
        data: { is_playing: true },
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        action: "playback_update",
      }));
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unregister = onState(callback);

      expect(typeof unregister).toBe("function");
    });

    it("should remove callback when unsubscribed", () => {
      const callback = vi.fn();
      const unregister = onState(callback);
      unregister();

      connect();
      MockWebSocket.instance?.simulateOpen();

      MockWebSocket.instance?.simulateMessage({
        action: "another_update",
        data: {},
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("message parsing", () => {
    it("should handle malformed JSON gracefully", () => {
      const callback = vi.fn();
      onState(callback);

      connect();
      MockWebSocket.instance?.simulateOpen();

      // Simulate invalid JSON - should not throw
      expect(() => {
        MockWebSocket.instance?.onmessage?.(new MessageEvent("message", {
          data: "not valid json {{{",
        }));
      }).not.toThrow();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle response without id as state update", () => {
      const callback = vi.fn();
      onState(callback);

      connect();
      MockWebSocket.instance?.simulateOpen();

      MockWebSocket.instance?.simulateMessage({
        action: "state_update",
        is_playing: false,
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle send failure gracefully", async () => {
      connect();
      MockWebSocket.instance?.simulateOpen();

      // Make send throw
      (MockWebSocket.instance!.send as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error("Send failed");
      });

      await expect(send("play")).rejects.toThrow("Failed to send");
    });
  });

  describe("state transitions", () => {
    it("should report disconnected initially", () => {
      expect(isConnected()).toBe(false);
    });

    it("should handle rapid open/close", () => {
      connect();
      MockWebSocket.instance?.simulateOpen();
      expect(isConnected()).toBe(true);
      
      disconnect();
      expect(isConnected()).toBe(false);
    });
  });
});
