import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTauriInvoke = vi.fn();

vi.mock('../lib/spotify', () => ({
  getAccessToken: vi.fn(() => 'sample-access-token'),
  ensureValidToken: vi.fn(() => Promise.resolve(true)),
  tauriInvoke: mockTauriInvoke,
}));

vi.mock('../lib/spotify-sdk', () => ({
  getTokenInfo: vi.fn(() => ({
    present: true,
    expired: false,
    expiresAt: 1893456000000,
    hasRefreshToken: true,
    preview: 'sample…token',
  })),
}));

vi.mock('../stores/spotify', () => ({
  isMockMode: { value: false },
  userProfile: { value: null },
  authError: { value: null },
  appError: { value: null },
}));

vi.mock('../stores/devices', () => ({
  availableDevices: { value: [] },
  localDevices: { value: [] },
  activeDevice: { value: null },
  selectedDeviceId: { value: null },
  effectiveDeviceId: { value: null },
  localConnectDeviceId: { value: null },
  isStartingLocalConnect: { value: false },
  isCapturingSpDc: { value: false },
  spDcCaptureError: { value: null },
  refreshDevices: vi.fn(() => Promise.resolve()),
}));

vi.mock('../stores/playback', () => ({
  playbackTrack: { value: null },
  playbackVolume: { value: 80 },
  playbackShuffle: { value: false },
  playbackRepeat: { value: 'off' },
  playbackProgress: { value: 0 },
  playbackDuration: { value: 0 },
  isPlaying: { value: false },
  likedTrack: { value: false },
}));

vi.mock('../stores/notifications', () => ({
  connectionStatus: { value: 'connected' },
  authStatus: { value: 'authenticated' },
  deviceStatus: { value: 'available' },
  playbackStatus: { value: 'ready' },
  systemHealth: { value: { internet: true, spotifyApi: true, websocket: true, lastCheck: Date.now() } },
  errorHistory: { value: [] },
  getErrorSummary: vi.fn(() => []),
}));

vi.mock('../stores/auth', () => ({
  validateToken: vi.fn(() => Promise.resolve(true)),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Diagnostics screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTauriInvoke.mockResolvedValue({
      credentials: { configured: true, client_id_status: 'ok', client_secret_status: 'ok', client_id_value: 'client-id-123' },
      has_stored_sp_dc: false,
      macos_version: '15.5.1',
      spx_force_librespot: false,
      app_version: '0.1.0',
      tauri_version: '2.0.0',
    });
  });

  it('renders all diagnostic sections', async () => {
    const Diagnostics = (await import('./Diagnostics')).default;
    render(<Diagnostics />);

    expect(screen.getByText('Auth')).toBeDefined();
    expect(screen.getByText('Playback')).toBeDefined();
    expect(screen.getByText('Devices')).toBeDefined();
    expect(screen.getByText('System')).toBeDefined();
    expect(screen.getByText('Backend')).toBeDefined();
    expect(screen.getByText('Network diagnostics')).toBeDefined();
  });

  it('fetches backend diagnostics on mount', async () => {
    const Diagnostics = (await import('./Diagnostics')).default;
    render(<Diagnostics />);

    await waitFor(() => {
      expect(mockTauriInvoke).toHaveBeenCalledWith('get_diagnostics');
    });
  });

  it('masks tokens by default', async () => {
    const Diagnostics = (await import('./Diagnostics')).default;
    render(<Diagnostics />);

    await waitFor(() => screen.getByText(/sample…-token/i));
    expect(screen.queryByText('sample-access-token')).toBeNull();
  });

  it('reveals tokens when the toggle is checked', async () => {
    const { getAccessToken } = await import('../lib/spotify');
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('full-token-value');

    const Diagnostics = (await import('./Diagnostics')).default;
    render(<Diagnostics />);

    // Masked display of a 17-char token: first 6 + … + last 6
    await waitFor(() => screen.getByText(/full-t…-value/i));
    expect(screen.queryByText('full-token-value')).toBeNull();

    const toggle = screen.getByLabelText(/Reveal tokens/i) as HTMLInputElement;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('full-token-value')).toBeDefined();
    });
  });

  it('shows backend credentials status', async () => {
    const Diagnostics = (await import('./Diagnostics')).default;
    render(<Diagnostics />);

    await waitFor(() => {
      expect(screen.getByText('0.1.0')).toBeDefined();
      expect(screen.getByText('2.0.0')).toBeDefined();
    });
  });
});
