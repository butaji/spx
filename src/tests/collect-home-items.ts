#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * Collect the exact home-screen items from the user's screenshot.
 *
 * Items to collect:
 *   1. Handsome Boy Modeling School Radio  → artist radio
 *   2. Tickets To My Downfall             → album
 *   3. Look... I found Jazz               → playlist
 *   4. Handsome Boy Modeling School - Best Of → playlist
 *   5. DJ                                 → Spotify AI DJ (no public API)
 *   6. Handsome Boy Modeling School       → artist
 *   7. Vega Trails Radio                  → artist radio
 *   8. Only By The Night                  → album
 *
 * Usage:
 *   export SPOTIFY_TOKEN=your_token
 *   deno run --allow-net --allow-env --allow-read --allow-write src/tests/collect-home-items.ts
 */

const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) {
  console.error("❌ SPOTIFY_TOKEN env var required");
  console.error("   Copy it from the app console: [Debug] Access token: BQ...");
  Deno.exit(1);
}

const BASE = "https://api.spotify.com/v1";

async function apiFetch(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function search(q: string, type: string, limit = 5): Promise<any> {
  const encoded = encodeURIComponent(q);
  return apiFetch(`/search?q=${encoded}&type=${type}&limit=${limit}`);
}

// ─── Targets from screenshot ───
const TARGETS = [
  { name: "Handsome Boy Modeling School Radio", kind: "radio" as const, seedArtist: "Handsome Boy Modeling School" },
  { name: "Tickets To My Downfall", kind: "album" as const, artistHint: "Machine Gun Kelly" },
  { name: "Look... I found Jazz", kind: "playlist" as const },
  { name: "Handsome Boy Modeling School - Best Of", kind: "playlist" as const, ownerHint: "Spotify" },
  { name: "DJ", kind: "dj" as const },
  { name: "Handsome Boy Modeling School", kind: "artist" as const },
  { name: "Vega Trails Radio", kind: "radio" as const, seedArtist: "Vega Trails" },
  { name: "Only By The Night", kind: "album" as const, artistHint: "Kings of Leon" },
];

const results: Record<string, any> = {};

console.log("🎯 COLLECTING HOME SCREEN ITEMS\n");

for (const target of TARGETS) {
  console.log(`─ ${target.name} (${target.kind}) ─`);

  if (target.kind === "dj") {
    console.log("  ⚠️  Spotify AI DJ has NO public API endpoint.");
    console.log("     It is only available inside Spotify's official apps.");
    results[target.name] = { found: false, reason: "No public API for Spotify DJ" };
    continue;
  }

  if (target.kind === "radio") {
    // Artist radios are not searchable as standalone entities.
    // We need the artist ID, then construct the radio URI manually.
    try {
      const data = await search(target.seedArtist!, "artist", 3);
      const artist = data.artists?.items?.[0];
      if (artist) {
        console.log(`  ✅ Artist: ${artist.name} (id=${artist.id})`);
        console.log(`  📻  Radio URI: spotify:radio:artist:${artist.id}`);
        results[target.name] = {
          found: true,
          type: "radio",
          artist: { id: artist.id, name: artist.name, images: artist.images },
          radioUri: `spotify:radio:artist:${artist.id}`,
        };
      } else {
        console.log("  ❌ Artist not found");
        results[target.name] = { found: false };
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      results[target.name] = { found: false, error: e.message };
    }
    continue;
  }

  if (target.kind === "artist") {
    try {
      const data = await search(target.name, "artist", 3);
      const artist = data.artists?.items?.[0];
      if (artist) {
        console.log(`  ✅ ID: ${artist.id} | URI: ${artist.uri}`);
        results[target.name] = {
          found: true,
          type: "artist",
          id: artist.id,
          uri: artist.uri,
          name: artist.name,
          images: artist.images,
          genres: artist.genres,
          popularity: artist.popularity,
        };
      } else {
        console.log("  ❌ Not found");
        results[target.name] = { found: false };
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      results[target.name] = { found: false, error: e.message };
    }
    continue;
  }

  if (target.kind === "album") {
    try {
      const q = target.artistHint
        ? `album:"${target.name}" artist:"${target.artistHint}"`
        : `"${target.name}"`;
      const data = await search(q, "album", 5);
      const album = data.albums?.items?.find((a: any) =>
        a.name.toLowerCase().includes(target.name.toLowerCase())
      ) || data.albums?.items?.[0];
      if (album) {
        console.log(`  ✅ ID: ${album.id} | URI: ${album.uri}`);
        console.log(`     Artist: ${album.artists?.map((a: any) => a.name).join(", ")}`);
        results[target.name] = {
          found: true,
          type: "album",
          id: album.id,
          uri: album.uri,
          name: album.name,
          images: album.images,
          artists: album.artists?.map((a: any) => ({ id: a.id, name: a.name })),
        };
      } else {
        console.log("  ❌ Not found");
        results[target.name] = { found: false };
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      results[target.name] = { found: false, error: e.message };
    }
    continue;
  }

  if (target.kind === "playlist") {
    try {
      // Try user's own playlists first
      const userPlaylists = await apiFetch("/me/playlists?limit=50");
      const ownMatch = userPlaylists.items?.find((p: any) =>
        p.name.toLowerCase().includes(target.name.toLowerCase().replace(/\.\.\./g, "").trim())
      );
      if (ownMatch) {
        console.log(`  ✅ Found in user's playlists: ${ownMatch.id}`);
        results[target.name] = {
          found: true,
          type: "playlist",
          source: "user_library",
          id: ownMatch.id,
          uri: ownMatch.uri,
          name: ownMatch.name,
          images: ownMatch.images,
          owner: ownMatch.owner,
        };
        continue;
      }

      // Fall back to global search
      const data = await search(target.name, "playlist", 10);
      const playlist = data.playlists?.items?.find((p: any) =>
        p.name.toLowerCase().includes(target.name.toLowerCase().replace(/-/g, " ").replace(/best of/g, "best of"))
      ) || data.playlists?.items?.[0];
      if (playlist) {
        console.log(`  ✅ Found via search: ${playlist.id} (owner: ${playlist.owner?.display_name})`);
        results[target.name] = {
          found: true,
          type: "playlist",
          source: "search",
          id: playlist.id,
          uri: playlist.uri,
          name: playlist.name,
          images: playlist.images,
          owner: playlist.owner,
        };
      } else {
        console.log("  ❌ Not found");
        results[target.name] = { found: false };
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      results[target.name] = { found: false, error: e.message };
    }
    continue;
  }
}

// ─── Summary ───
console.log("\n" + "═".repeat(60));
console.log("SUMMARY");
console.log("═".repeat(60));

const found = Object.values(results).filter((r: any) => r.found);
const missing = Object.entries(results).filter(([, r]: [string, any]) => !r.found);

console.log(`\nFound: ${found.length}/${TARGETS.length}`);
console.log(`Missing: ${missing.length}/${TARGETS.length}\n`);

for (const [name, r] of missing) {
  console.log(`  ❌ ${name}: ${(r as any).reason || "Not found"}`);
}

// Save JSON
const outFile = "./home-items-collected.json";
await Deno.writeTextFile(outFile, JSON.stringify(results, null, 2));
console.log(`\n💾 Saved to ${outFile}`);
