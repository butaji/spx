/**
 * Tauri invoke abstraction.
 *
 * In a real Tauri webview (`__is_spx_shim__` = true) this uses native Tauri IPC.
 * In browser/Vite dev-server mode it talks to the Rust browser backend over HTTP
 * on 127.0.0.1:1422 via POST /invoke/<cmd>.
 *
 * Extracted to its own module so it can be vi.mock'd in unit tests.
 */

export let __spxBackendUrl = '';
export function setSpxBackendUrl(url: string) { __spxBackendUrl = url; }

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const isTauriShim =
    typeof window !== 'undefined' &&
    (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;

  if (isTauriShim) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }

  // Browser / Vite dev-server
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
  return res.json() as Promise<T>;
}
