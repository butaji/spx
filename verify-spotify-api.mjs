import fs from 'fs';

const tokenPath = '/tmp/spx_token.json';
const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const accessToken = token.access_token;

const api = async (endpoint, method = 'GET', body = null) => {
  const url = `https://api.spotify.com/v1${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body: json || text };
};

const checks = [];
const check = (name, result, status) => {
  checks.push({ name, ok: result, status });
  console.log(`${result ? '✅' : '❌'} ${name}${status ? ` (${status})` : ''}`);
};

(async () => {
  console.log('=== Spotify API Verification ===\n');

  // Profile
  const profile = await api('/me');
  check('Get current user profile', profile.ok, profile.status);

  // Playback state
  const pb = await api('/me/player');
  check('Get playback state', pb.status === 200 || pb.status === 204, pb.status);

  // Devices
  const devices = await api('/me/player/devices');
  check('Get devices', devices.ok, devices.status);
  if (devices.ok) {
    console.log(`   Found ${devices.body.devices?.length || 0} device(s)`);
  }

  // Queue
  const queue = await api('/me/player/queue');
  check('Get queue', queue.ok, queue.status);

  // Recently played
  const recent = await api('/me/player/recently-played?limit=5');
  check('Get recently played', recent.ok, recent.status);

  // Top tracks
  const topTracks = await api('/me/top/tracks?limit=5');
  check('Get top tracks', topTracks.ok, topTracks.status);

  // Top artists
  const topArtists = await api('/me/top/artists?limit=5');
  check('Get top artists', topArtists.ok, topArtists.status);

  // Saved tracks
  const saved = await api('/me/tracks?limit=5');
  check('Get saved tracks', saved.ok, saved.status);

  // Saved albums
  const albums = await api('/me/albums?limit=5');
  check('Get saved albums', albums.ok, albums.status);

  // Followed artists
  const followed = await api('/me/following?type=artist&limit=5');
  check('Get followed artists', followed.ok, followed.status);

  // Playlists
  const playlists = await api('/me/playlists?limit=5');
  check('Get user playlists', playlists.ok, playlists.status);

  // Search
  const search = await api('/search?q=Daft+Punk&type=track,artist,album,playlist&limit=5');
  check('Search', search.ok, search.status);

  // Browse categories
  const cats = await api('/browse/categories?limit=5');
  check('Browse categories', cats.ok, cats.status);

  // New releases
  const newRel = await api('/browse/new-releases?limit=5');
  check('New releases', newRel.ok, newRel.status);

  // Playback control with no device (should fail gracefully)
  console.log('\n=== Playback Controls (no device expected) ===');
  const play = await api('/me/player/play', 'PUT');
  check('Play/pause API reachable', play.status === 404 || play.status === 403 || play.status === 204, play.status);
  if (!play.ok && play.body?.error?.reason) {
    console.log(`   Reason: ${play.body.error.reason}`);
  }

  const next = await api('/me/player/next', 'POST');
  check('Next API reachable', next.status === 404 || next.status === 403 || next.status === 204, next.status);

  const prev = await api('/me/player/previous', 'POST');
  check('Previous API reachable', prev.status === 404 || prev.status === 403 || prev.status === 204, prev.status);

  const passed = checks.filter(c => c.ok).length;
  console.log(`\n=== RESULTS: ${passed}/${checks.length} passed ===`);
  if (passed < checks.length) process.exitCode = 1;
})();
