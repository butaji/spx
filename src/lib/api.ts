/**
 * API client for the Rust backend.
 * In Tauri mode: calls invoke().
 * In browser/network mode: calls HTTP API server.
 */

type ApiFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

let api: ApiFn;

// Detect mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const apiUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : null;

if (isTauri) {
  // Tauri mode: use invoke
  api = async (cmd, args) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(cmd, args);
  };
} else if (apiUrl) {
  // Network mode: call HTTP API
  api = async (cmd, args) => {
    const path = cmd === 'init_backend' ? '/api/init' : `/api/${cmd.replace('backend_', '')}`;
    const isGet = ['get_devices', 'get_playback_state', 'health', 'scan'].some(s => cmd.includes(s));
    const url = `${apiUrl}${path}`;
    const res = await fetch(url, isGet ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: args ? JSON.stringify(args) : undefined,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };
} else {
  // Fallback: no backend available
  api = async () => { throw new Error('No backend available'); };
}

export { api };
export const isApiAvailable = isTauri || !!apiUrl;
