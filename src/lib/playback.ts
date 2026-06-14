export let currentDeviceId: string | null = null;

export function getDeviceId(): string | null { return currentDeviceId; }

export async function initPlayer(_token: string): Promise<void> {}

export async function disconnectPlayer(): Promise<void> { currentDeviceId = null; }

export type PlaybackEventType = string;
export interface PlaybackEvent { type: PlaybackEventType; data?: any; }
type EventCallback = (event: PlaybackEvent) => void;

const eventListeners = new Set<EventCallback>();

export function onPlaybackEvent(callback: EventCallback): () => void {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}
