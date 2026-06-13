#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * Fetch and analyze ALL recent activity data from Spotify API.
 * This mirrors what the app loads for the Home screen "Recent" section.
 *
 * Usage:
 *   export SPOTIFY_TOKEN=your_token
 *   deno run --allow-net --allow-env --allow-read --allow-write src/tests/fetch-recent-activity.ts
 *
 * Or pass token as arg:
 *   deno run --allow-net --allow-env --allow-read --allow-write src/tests/fetch-recent-activity.ts YOUR_TOKEN
 */

const TOKEN = Deno.args[0] || Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) {
  console.error("❌ SPOTIFY_TOKEN env var or CLI arg required");
  console.error("   Get one from the app console (logged on startup) or Spotify Console");
  Deno.exit(1);
}

const BASE = "https://api.spotify.com/v1";

async function apiFetch(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function section(title: string) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function subSection(title: string) {
  console.log("\n── " + title + " ──");
}

async function main() {
  console.log("🎵 SPOTIFY RECENT ACTIVITY AUDIT");
  console.log(`Token: ${TOKEN.slice(0, 20)}...`);

  // ─── 1. RECENTLY PLAYED (the core signal for recent activity) ───
  section("1. RECENTLY PLAYED TRACKS (me/player/recently-played)");
  const recentlyPlayed = await apiFetch("/me/player/recently-played?limit=50");
  const rpItems = recentlyPlayed.items ?? [];
  console.log(`Total tracks: ${rpItems.length}`);

  // Analyze contexts
  const contexts: Record<string, { type: string; uri: string; count: number }[]> = {};
  rpItems.forEach((item: any) => {
    const ctx = item.context;
    if (ctx?.uri) {
      const key = `${ctx.type}|${ctx.uri}`;
      if (!contexts[key]) contexts[key] = [];
      contexts[key].push(ctx);
    }
  });

  subSection("Contexts found (albums / playlists / artists from track context)");
  const contextEntries = Object.entries(contexts)
    .map(([key, vals]) => ({ key, type: key.split("|")[0], uri: key.split("|")[1], count: vals.length }))
    .sort((a, b) => b.count - a.count);

  for (const ctx of contextEntries.slice(0, 10)) {
    console.log(`  [${ctx.type}] ${ctx.uri} — appeared ${ctx.count} times`);
  }

  subSection("Most recent 5 tracks");
  rpItems.slice(0, 5).forEach((item: any, i: number) => {
    const t = item.track;
    console.log(`  ${i + 1}. ${t?.name} — ${t?.artists?.map((a: any) => a.name).join(", ")}`);
    console.log(`     Album: ${t?.album?.name} | Context: ${item.context?.type || "none"}`);
  });

  // ─── 2. TOP ARTISTS (generates Artist Radio cards) ───
  section("2. TOP ARTISTS (me/top/artists) → Artist Radios");
  const topArtists = await apiFetch("/me/top/artists?limit=10&time_range=short_term");
  console.log(`Total: ${topArtists.items?.length ?? 0}`);
  topArtists.items?.slice(0, 5).forEach((a: any, i: number) => {
    console.log(`  ${i + 1}. ${a.name} → "${a.name} Radio" (spotify:radio:artist:${a.id})`);
  });

  // ─── 3. TOP TRACKS (extract unique albums) ───
  section("3. TOP TRACKS (me/top/tracks) → Album cards");
  const topTracks = await apiFetch("/me/top/tracks?limit=20&time_range=short_term");
  const albumsFromTracks = new Map<string, any>();
  topTracks.items?.forEach((t: any) => {
    if (t.album?.id && !albumsFromTracks.has(t.album.id)) {
      albumsFromTracks.set(t.album.id, t.album);
    }
  });
  console.log(`Unique albums from top tracks: ${albumsFromTracks.size}`);
  Array.from(albumsFromTracks.values()).slice(0, 5).forEach((a: any, i: number) => {
    console.log(`  ${i + 1}. ${a.name}`);
  });

  // ─── 4. USER PLAYLISTS ───
  section("4. USER PLAYLISTS (me/playlists)");
  const playlists = await apiFetch("/me/playlists?limit=20");
  console.log(`Total: ${playlists.items?.length ?? 0}`);
  playlists.items?.slice(0, 5).forEach((p: any, i: number) => {
    console.log(`  ${i + 1}. ${p.name} by ${p.owner?.display_name || "unknown"}`);
  });

  // ─── 5. SAVED ALBUMS ───
  section("5. SAVED ALBUMS (me/albums)");
  try {
    const savedAlbums = await apiFetch("/me/albums?limit=20");
    const albums = savedAlbums.items?.map((item: any) => item.album).filter(Boolean) ?? [];
    console.log(`Total: ${albums.length}`);
    albums.slice(0, 5).forEach((a: any, i: number) => {
      console.log(`  ${i + 1}. ${a.name} — ${a.artists?.map((ar: any) => ar.name).join(", ")}`);
    });
  } catch (e: any) {
    console.log(`  ⚠️  ${e.message}`);
  }

  // ─── 6. FOLLOWED ARTISTS ───
  section("6. FOLLOWED ARTISTS (me/following?type=artist)");
  try {
    const followed = await apiFetch("/me/following?type=artist&limit=20");
    const artists = followed.artists?.items ?? [];
    console.log(`Total: ${artists.length}`);
    artists.slice(0, 5).forEach((a: any, i: number) => {
      console.log(`  ${i + 1}. ${a.name}`);
    });
  } catch (e: any) {
    console.log(`  ⚠️  ${e.message}`);
    console.log("     → Need 'user-follow-read' scope in your token");
  }

  // ─── BUILD SIMULATED HOME FEED ───
  section("7. SIMULATED HOME FEED (Recent)");
  const feed: { type: string; name: string; id: string }[] = [];
  const seen = new Set<string>();
  const add = (type: string, name: string, id: string) => {
    if (!seen.has(id) && feed.length < 16) {
      seen.add(id);
      feed.push({ type, name, id });
    }
  };

  // Priority 1: Recent containers (albums/playlists from context)
  const recentContainers: any[] = [];
  const containerMap = new Map<string, any>();
  rpItems.forEach((item: any) => {
    const album = item.track?.album;
    if (album?.id && !containerMap.has(album.id)) {
      containerMap.set(album.id, { type: "album", name: album.name, id: album.id });
    }
    const ctx = item.context;
    if (ctx?.type === "playlist" && ctx?.uri) {
      const pid = ctx.uri.split(":")[2];
      if (pid && !containerMap.has(pid)) {
        containerMap.set(pid, { type: "playlist", name: `playlist:${pid}`, id: pid });
      }
    }
  });
  Array.from(containerMap.values()).slice(0, 8).forEach((c) => {
    add(c.type, c.name, c.id);
  });

  // Priority 2: Artist radios
  topArtists.items?.slice(0, 4).forEach((a: any) => {
    add("radio", `${a.name} Radio`, `radio-${a.id}`);
  });

  // Priority 3: Saved albums
  // (skipped in simulation unless we fetch names)

  // Priority 4: Followed artists
  // (skipped in simulation unless we fetch names)

  // Priority 5: Top track albums
  Array.from(albumsFromTracks.values()).slice(0, 4).forEach((a: any) => {
    add("album", a.name, a.id);
  });

  // Priority 6: User playlists
  playlists.items?.slice(0, 4).forEach((p: any) => {
    add("playlist", p.name, p.id);
  });

  console.log(`Built ${feed.length} items:\n`);
  feed.forEach((item, i) => {
    const icon = item.type === "radio" ? "📻" : item.type === "artist" ? "🎤" : item.type === "playlist" ? "📂" : "💿";
    console.log(`  ${i + 1}. ${icon} [${item.type}] ${item.name}`);
  });

  console.log("\n" + "═".repeat(60));
  console.log("✅ Audit complete\n");
}

main().catch((e) => {
  console.error("\n❌ Fatal error:", e.message);
  Deno.exit(1);
});
