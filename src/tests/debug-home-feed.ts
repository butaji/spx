/**
 * Debug script: Analyze Spotify API data for home feed construction
 * 
 * Usage:
 *   SPOTIFY_TOKEN=your_token deno run --allow-net --allow-env src/tests/debug-home-feed.ts
 * 
 * Or set the env var first:
 *   export SPOTIFY_TOKEN=your_token && deno run --allow-net --allow-env src/tests/debug-home-feed.ts
 */

const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) {
  console.error("ERROR: SPOTIFY_TOKEN environment variable is required");
  console.error("Usage: SPOTIFY_TOKEN=your_token deno run --allow-net --allow-env src/tests/debug-home-feed.ts");
  Deno.exit(1);
}

const BASE = "https://api.spotify.com/v1";

async function apiFetch(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log("\n🔍 SPOTIFY HOME FEED DATA ANALYSIS\n");
  console.log("═".repeat(60));

  // 1. TOP ARTISTS
  console.log("\n=== TOP ARTISTS (10) ===");
  try {
    const artists = await apiFetch("/me/top/artists?limit=10&time_range=short_term");
    console.log(`Total items returned: ${artists.items?.length ?? 0}`);
    console.log("\nFirst 5 artists:");
    artists.items?.slice(0, 5).forEach((a: any, i: number) => {
      console.log(`  ${i + 1}. ${a.name} (ID: ${a.id})`);
    });
    if (artists.items?.length > 5) {
      console.log(`  ... and ${artists.items.length - 5} more`);
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }

  // 2. TOP TRACKS
  console.log("\n=== TOP TRACKS (20) ===");
  try {
    const tracks = await apiFetch("/me/top/tracks?limit=20&time_range=short_term");
    console.log(`Total items returned: ${tracks.items?.length ?? 0}`);
    console.log("\nFirst 10 tracks (name - album):");
    tracks.items?.slice(0, 10).forEach((t: any, i: number) => {
      const albumName = t.album?.name ?? "Unknown Album";
      console.log(`  ${i + 1}. ${t.name} - ${albumName}`);
    });
    if (tracks.items?.length > 10) {
      console.log(`  ... and ${tracks.items.length - 10} more`);
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }

  // 3. RECENTLY PLAYED
  console.log("\n=== RECENTLY PLAYED (50) ===");
  try {
    const recentlyPlayed = await apiFetch("/me/player/recently-played?limit=50");
    const items = recentlyPlayed.items ?? [];
    console.log(`Total items returned: ${items.length}`);

    // Analyze context field
    const itemsWithContext = items.filter((item: any) => item.context);
    const itemsWithoutContext = items.length - itemsWithContext.length;
    console.log(`\nItems with context: ${itemsWithContext.length}/${items.length}`);
    console.log(`Items without context: ${itemsWithoutContext}/${items.length}`);

    // Analyze context types
    const contextTypes: Record<string, number> = {};
    itemsWithContext.forEach((item: any) => {
      const type = item.context?.type ?? "unknown";
      contextTypes[type] = (contextTypes[type] || 0) + 1;
    });
    console.log("\nContext types found:");
    const typeSummary = Object.entries(contextTypes)
      .map(([type, count]) => `${type} (${count})`)
      .join(", ");
    console.log(`  ${typeSummary}`);

    // Extract unique playlist IDs from context URIs
    const playlistUris: Record<string, number> = {};
    itemsWithContext.forEach((item: any) => {
      if (item.context?.type === "playlist" && item.context?.uri) {
        const uri = item.context.uri;
        playlistUris[uri] = (playlistUris[uri] || 0) + 1;
      }
    });

    console.log("\nPlaylists found in context:");
    if (Object.keys(playlistUris).length > 0) {
      // Sort by count descending
      const sorted = Object.entries(playlistUris).sort((a, b) => b[1] - a[1]);
      
      // Fetch playlist names for the top 5 most played
      const topPlaylists = sorted.slice(0, 5);
      const playlistIds = topPlaylists.map(([uri]) => {
        const id = uri.replace("spotify:playlist:", "");
        return id;
      });

      console.log(`  (Fetching names for top ${topPlaylists.length} playlists...)`);

      // Fetch playlist details in parallel
      const playlistDetails = await Promise.all(
        playlistIds.map(async (id) => {
          try {
            const pl = await apiFetch(`/playlists/${id}`);
            return { id, name: pl.name ?? "Unknown" };
          } catch {
            return { id, name: "Error fetching" };
          }
        })
      );

      const nameMap: Record<string, string> = {};
      playlistDetails.forEach((pl) => {
        nameMap[pl.id] = pl.name;
      });

      sorted.forEach(([uri, count]) => {
        const id = uri.replace("spotify:playlist:", "");
        const name = nameMap[id] ?? id;
        console.log(`  - ${id}: "${name}" (appeared ${count} times)`);
      });

      if (sorted.length > 5) {
        console.log(`  ... and ${sorted.length - 5} more playlists`);
      }
    } else {
      console.log("  (none found)");
    }

    // Show first 5 items as sample
    console.log("\nFirst 5 recently played items:");
    items.slice(0, 5).forEach((item: any, i: number) => {
      const trackName = item.track?.name ?? "Unknown Track";
      const contextType = item.context?.type ?? "(no context)";
      const contextUri = item.context?.uri ?? "";
      console.log(`  ${i + 1}. ${trackName}`);
      console.log(`     context: ${contextType} ${contextUri}`);
    });
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }

  // 4. USER PLAYLISTS
  console.log("\n=== USER PLAYLISTS (20) ===");
  try {
    const playlists = await apiFetch("/me/playlists?limit=20");
    console.log(`Total items returned: ${playlists.items?.length ?? 0}`);
    console.log("\nFirst 5 playlists:");
    playlists.items?.slice(0, 5).forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. ${p.name} (ID: ${p.id})`);
    });
    if (playlists.items?.length > 5) {
      console.log(`  ... and ${playlists.items.length - 5} more`);
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }

  console.log("\n" + "═".repeat(60));
  console.log("✅ Analysis complete\n");
}

main().catch((e) => {
  console.error("\n❌ Fatal error:", e.message);
  Deno.exit(1);
});
