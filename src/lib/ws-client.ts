type WsResponse = {
  ok: boolean;
  action: string;
  data?: unknown;
  error?: string;
};

type StateCallback = (state: Record<string, unknown>) => void;

const WS_URL =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_WS_URL
    ? import.meta.env.VITE_WS_URL
    : "ws://127.0.0.1:1424";
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const REQUEST_TIMEOUT = 30000;
const CONNECT_TIMEOUT = 10000;

let ws: WebSocket | null = null;
let connecting = false;
let pending = new Map<
  string,
  {
    resolve: (v: WsResponse) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
let requestId = 0;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stateCallbacks: StateCallback[] = [];
let connected = false;
let intentionalClose = false;

function getNextId(): string {
  requestId++;
  return `req_${requestId}_${Date.now()}`;
}

function rejectAllPending(reason: string): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
}

function connect(): void {
  if (connecting) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  connecting = true;
  intentionalClose = false;

  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    connecting = false;
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    connecting = false;
    reconnectAttempts = 0;
    connected = true;
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as WsResponse & { id?: string };
      const id = msg.id;

      if (id && pending.has(id)) {
        const entry = pending.get(id)!;
        clearTimeout(entry.timer);
        pending.delete(id);
        if (msg.ok) {
          entry.resolve(msg);
        } else {
          entry.reject(new Error(msg.error || `Action failed: ${msg.action}`));
        }
      } else {
        stateCallbacks.forEach((cb) => cb(msg as unknown as Record<string, unknown>));
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    connecting = false;
    connected = false;
    ws = null;
    rejectAllPending("WebSocket disconnected");

    if (!intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    connecting = false;
    ws?.close();
  };
}

function scheduleReconnect(): void {
  const delay = Math.min(
    RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  reconnectAttempts++;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, delay);
}

function disconnect(): void {
  intentionalClose = true;
  connecting = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  rejectAllPending("WebSocket closed intentionally");
  ws?.close();
  ws = null;
  connected = false;
}

async function send(
  action: string,
  params: Record<string, unknown> = {}
): Promise<WsResponse> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          resolve();
        } else if (ws && ws.readyState === WebSocket.CLOSED) {
          reject(new Error("WebSocket closed"));
        } else if (Date.now() - start > CONNECT_TIMEOUT) {
          reject(new Error("WebSocket connection timeout"));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  const id = getNextId();
  const msg = JSON.stringify({ id, action, ...params });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Request timeout: ${action}`));
    }, REQUEST_TIMEOUT);

    pending.set(id, { resolve, reject, timer });
    
    try {
      ws!.send(msg);
    } catch (e) {
      pending.delete(id);
      clearTimeout(timer);
      reject(new Error(`Failed to send: ${e instanceof Error ? e.message : String(e)}`));
    }
  });
}

export function onState(callback: StateCallback): () => void {
  stateCallbacks.push(callback);
  return () => {
    stateCallbacks = stateCallbacks.filter((cb) => cb !== callback);
  };
}

export function isConnected(): boolean {
  return connected;
}

export { connect, disconnect, send };
