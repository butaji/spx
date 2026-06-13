#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Record API responses from Spotify API
 * Usage: deno run --allow-net --allow-env record-api.ts
 */

const TOKEN = Deno.env.get("SPOTIFY_TOKEN") || 
  "BQDyl95jKkO_tZ1X23-RSqWlRXd2KGnQ_EX2goRJhiT3Y0ZFKpXT1piuW5nE62PFnPOTVdsQ0PXGjHzaWeYvoJb274-L6Ee6Avj4pqWn5Oeocr6izWBUlIsIlKS8TsJ8ad-dwqp9BVrtsOOhbul_V_lLQlwbMQZup0X-Lb8w2hNiZpKFDmNCnwt_LxmZhRd0hvWwAJi6C-QVFXgFjguWYRCtxJRbbi-DW5utH_kzz3P8Z_164MfhaWIgYO_GQCXf7uZBy9tDpkWDXdq0US2cmD0";

const BASE_URL = "https://api.spotify.com";

interface Endpoint {
  method: string;
  path: string;
  fixture: string;
  description: string;
  expectEmpty?: boolean; // for 204 responses
}

const endpoints: Endpoint[] = [
  { method: "GET", path: "/v1/me", fixture: "me.json", description: "User profile" },
  { method: "GET", path: "/v1/me/player", fixture: "player.json", description: "Current playback" },
  { method: "GET", path: "/v1/me/player/devices", fixture: "devices.json", description: "Devices" },
  { method: "GET", path: "/v1/me/playlists", fixture: "playlists.json", description: "Playlists" },
  { method: "GET", path: "/v1/me/tracks", fixture: "tracks.json", description: "Saved tracks" },
  { method: "GET", path: "/v1/me/albums", fixture: "albums.json", description: "Saved albums" },
  { method: "GET", path: "/v1/me/player/recently-played?limit=50", fixture: "recently-played.json", description: "Recently played" },
  { method: "GET", path: "/v1/me/player/queue", fixture: "queue.json", description: "Queue" },
  { method: "GET", path: "/v1/artists/4Z8W4fKeB5YxbusRsdQVPb", fixture: "artist.json", description: "Artist (Radiohead)" },
  { method: "GET", path: "/v1/search?q=test&type=track", fixture: "search.json", description: "Search" },
  { method: "PUT", path: "/v1/me/player/play", fixture: "play-error.json", description: "Play (expect error - no device)", expectEmpty: true },
  { method: "PUT", path: "/v1/me/player/pause", fixture: "pause-empty.json", description: "Pause", expectEmpty: true },
];

interface ManifestEntry {
  fixture: string;
  method: string;
  path: string;
  description: string;
  recordedAt: string;
  status: number;
}

interface Manifest {
  version: string;
  recordedAt: string;
  tokenPrefix: string;
  endpoints: ManifestEntry[];
}

async function fetchEndpoint(endpoint: Endpoint): Promise<{ status: number; data: any }> {
  const url = BASE_URL + endpoint.path;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method: endpoint.method,
    headers,
  };

  if (endpoint.method === "PUT") {
    options.body = JSON.stringify({});
  }

  const response = await fetch(url, options);
  const text = await response.text();
  const status = response.status;

  let data: any = null;
  if (text && !endpoint.expectEmpty) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  return { status, data };
}

async function main() {
  console.log("🎙️  SPX API Recording Script");
  console.log("=".repeat(50));
  console.log(`Token prefix: ${TOKEN.slice(0, 20)}...`);
  console.log("");

  const manifest: Manifest = {
    version: "1.0.0",
    recordedAt: new Date().toISOString(),
    tokenPrefix: TOKEN.slice(0, 20),
    endpoints: [],
  };

  for (const endpoint of endpoints) {
    const url = `${endpoint.method} ${endpoint.path}`;
    process.stdout.write(`Recording: ${url.padEnd(55)} `);

    try {
      const { status, data } = await fetchEndpoint(endpoint);

      const fixturePath = `./fixtures/${endpoint.fixture}`;
      const fullPath = new URL(fixturePath, import.meta.url).pathname;

      if (endpoint.expectEmpty && status !== 204) {
        // Save error response for error handling tests
        const errorData = {
          error: true,
          status,
          body: data || { message: "No content" }
        };
        await Deno.writeTextFile(fullPath, JSON.stringify(errorData, null, 2));
        console.log(`⚠️  ${status} (error fixture saved)`);
      } else if (status === 204) {
        // Empty response
        const emptyData = { _empty: true, status: 204 };
        await Deno.writeTextFile(fullPath, JSON.stringify(emptyData, null, 2));
        console.log(`✅ ${status} (empty)`);
      } else if (status === 200 || status === 201) {
        await Deno.writeTextFile(fullPath, JSON.stringify(data, null, 2));
        console.log(`✅ ${status}`);
      } else {
        // Unexpected status
        const unexpectedData = { _unexpected: true, status, data };
        await Deno.writeTextFile(fullPath, JSON.stringify(unexpectedData, null, 2));
        console.log(`⚠️  ${status}`);
      }

      manifest.endpoints.push({
        fixture: endpoint.fixture,
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        recordedAt: new Date().toISOString(),
        status,
      });

    } catch (error) {
      console.log(`❌ Error: ${error}`);
      manifest.endpoints.push({
        fixture: endpoint.fixture,
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        recordedAt: new Date().toISOString(),
        status: 0,
      });
    }
  }

  // Write manifest
  const manifestPath = new URL("./fixtures/manifest.json", import.meta.url).pathname;
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("");
  console.log("=".repeat(50));
  console.log(`✅ Recording complete!`);
  console.log(`📁 ${endpoints.length} fixtures saved`);
  console.log(`📋 Manifest written to: ${manifestPath}`);
}

main().catch(console.error);
