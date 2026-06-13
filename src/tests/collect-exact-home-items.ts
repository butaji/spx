#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * Collect the EXACT items shown in the home-screen screenshot.
 *
 * Targets:
 *   1. Handsome Boy Modeling School Radio  (artist radio)
 *   2. Tickets To My Downfall              (album)
 *   3. Look... I found Jazz                (playlist)
 *   4. Handsome Boy Modeling School - Best Of (playlist)
 *   5. DJ                                  (Spotify AI DJ — no public API)
 *   6. Handsome Boy Modeling School        (artist)
 *   7. Vega Trails Radio                   (artist radio)
 *   8. Only By The Night                   (album)
 *
 * Usage:
 *   export SPOTIFY_TOKEN=$(copy from app console)
 *   deno run --allow-net --allow-env --allow-read --allow-write src/tests/collect-exact-home-items.ts
 */

const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) {
  console.error("❌ Set SPOTIFY_TOKEN env var (copy from browser console: [Debug] Access token: …)");
  Deno.exit(1);
}

const BASE = "https://api.spotify.com/v1";

async function api(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function search(q: string, type: string, limit = 5): Promise<any> {
  return api(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`);
}

// ─── 1. Check user’s own recent activity for matches ───
console.log("🔍 Fetching your recent activity…\n");

const [recentlyPlayed, topArtists, savedAlbums, userPlaylists, followedArtists] =
  await Promise.all([
    api("/me/player/recently-played?limit=50").catch(() => ({ items: [] })),
    api("/me/top/artists?limit=20&time_range=short_term").catch(() => ({ items: [] })),
    api("/me/albums?limit=50").catch(() => ({ items: [] })),
    api("/me/playlists?limit=50").catch(() => ({ items: [] })),
    api("/me/following?type=artist&limit=50").catch(() => ({ artists: { items: [] } })),
  ]);

// Build lookup maps
const recentAlbums = new Map<string, any>();
const recentPlaylists = new Map<string, any>();
for (const item of recentlyPlayed.items ?? []) {
  const album = item.track?.album;
  if (album?.id) recentAlbums.set(album.id, album);
  const ctx = item.context;
  if (ctx?.type === "playlist" && ctx?.uri) {
    const pid = ctx.uri.split(":")[2];
    if (pid) recentPlaylists.set(pid, { id: pid, uri: ctx.uri });
  }
}

const savedAlbumMap = new Map(
  (savedAlbums.items ?? []).map((it: any) => [it.album?.id, it.album]).filter(([k]: any) => k)
);
const playlistMap = new Map(
  (userPlaylists.items ?? []).map((p: any) => [p.id, p])
);
const artistMap = new Map(
  [...(topArtists.items ?? []), ...(followedArtists.artists?.items ?? [])].map((a: any) => [a.id, a])
);

// ─── 2. Resolve each target ───
const targets = [
  {
    label: "Handsome Boy Modeling School Radio",
    kind: "radio" as const,
    find: async () => {
      const data = await search("Handsome Boy Modeling School", "artist", 3);
      const a = data.artists?.items?.[0];
      return a ? { type: "radio", artist: a, uri: `spotify:radio:artist:${a.id}` } : null;
    },
  },
  {
    label: "Tickets To My Downfall",
    kind: "album" as const,
    find: async () => {
      // Try saved albums first
      for (const [, album] of savedAlbumMap) {
        if (album.name.toLowerCase().includes("tickets to my downfall")) return { type: "album", ...album };
      }
      const data = await search('album:"Tickets To My Downfall" artist:"Machine Gun Kelly"', "album", 5);
      return data.albums?.items?.[0] ? { type: "album", ...data.albums.items[0] } : null;
    },
  },
  {
    label: "Look... I found Jazz",
    kind: "playlist" as const,
    find: async () => {
      for (const [, p] of playlistMap) {
        if (p.name.toLowerCase().includes("look") && p.name.toLowerCase().includes("jazz"))
          return { type: "playlist", ...p };
      }
      const data = await search("Look... I found Jazz", "playlist", 5);
      return data.playlists?.items?.[0] ? { type: "playlist", ...data.playlists.items[0] } : null;
    },
  },
  {
    label: "Handsome Boy Modeling School - Best Of",
    kind: "playlist" as const,
    find: async () => {
      for (const [, p] of playlistMap) {
        if (p.name.toLowerCase().includes("best of") && p.name.toLowerCase().includes("handsome boy"))
          return { type: "playlist", ...p };
      }
      const data = await search("Handsome Boy Modeling School Best Of", "playlist", 5);
      return data.playlists?.items?.[0] ? { type: "playlist", ...data.playlists.items[0] } : null;
    },
  },
  {
    label: "DJ",
    kind: "dj" as const,
    find: async () => {
      return null; // No public API
    },
  },
  {
    label: "Handsome Boy Modeling School",
    kind: "artist" as const,
    find: async () => {
      for (const [, a] of artistMap) {
        if (a.name.toLowerCase() === "handsome boy modeling school") return { type: "artist", ...a };
      }
      const data = await search("Handsome Boy Modeling School", "artist", 3);
      return data.artists?.items?.[0] ? { type: "artist", ...data.artists.items[0] } : null;
    },
  },
  {
    label: "Vega Trails Radio",
    kind: "radio" as const,
    find: async () => {
      const data = await search("Vega Trails", "artist", 3);
      const a = data.artists?.items?.[0];
      return a ? { type: "radio", artist: a, uri: `spotify:radio:artist:${a.id}` } : null;
    },
  },
  {
    label: "Only By The Night",
    kind: "album" as const,
    find: async () => {
      for (const [, album] of savedAlbumMap) {
        if (album.name.toLowerCase().includes("only by the night")) return { type: "album", ...album };
      }
      const data = await search('album:"Only By The Night" artist:"Kings of Leon"', "album", 5);
      return data.albums?.items?.[0] ? { type: "album", ...data.albums.items[0] } : null;
    },
  },
];

const results: Record<string, any> = {};

for (const t of targets) {
  console.log(`─ ${t.label}`);
  try {
    const found = await t.find();
    if (t.kind === "dj") {
      console.log("  ⚠️  Spotify AI DJ has NO public API. Only available in official Spotify apps.");
      results[t.label] = { found: false, note: "No public API for Spotify DJ" };
    } else if (found) {
      const { type, ...rest } = found;
      console.log(`  ✅ ${type} | ${rest.name ?? rest.id} | ${rest.uri ?? ""}`);
      results[t.label] = { found: true, type, ...rest };
    } else {
      console.log("  ❌ Not found");
      results[t.label] = { found: false };
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
    results[t.label] = { found: false, error: e.message };
  }
}

// ─── 3. Write results ───
const outPath = "./home-exact-items.json";
await Deno.writeTextFile(outPath, JSON.stringify(results, null, 2));

console.log("\n" + "═".repeat(60));
const ok = Object.values(results).filter((r: any) => r.found).length;
console.log(`Collected ${ok}/${targets.length} items → ${outPath}`);
console.log("═".repeat(60) + "\n");
