/**
 * Tauri invoke abstraction.
 *
 * Uses the real @tauri-apps/api/core invoke in Tauri app mode.
 * Falls back to HTTP fetch in browser dev-server mode (for the Rust browser backend).
 *
 * Extracted to its own module so it can be vi.mock'd in unit tests.
 */

export let __spxBackendUrl = '';
export function setSpxBackendUrl(url: string) { __spxBackendUrl = url; }

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Try real Tauri invoke first
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    // If Tauri invoke fails (e.g., in browser dev mode), fall back to HTTP
    const err = e as Error;
    if (!err.message?.includes('invoke channel') && !err.message?.includes('tauri')) {
      throw e; // Re-throw if it's not a Tauri-related error
    }
  }

  // Browser / Vite dev-server - call Rust browser backend
  const base = __spxBackendUrl || '';
  const res = await fetch(`${base}/invoke/${cmd}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `status ${res.status}`);
    throw new Error(text || `Command ${cmd} failed with status ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Invalid JSON from ${cmd}: ${text.slice(0, 200)}`);
  }
}
