#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * SPX API Recording Script
 * 
 * Records real Spotify API responses to fixtures-real/
 * Usage: deno run --allow-net --allow-read --allow-write --allow-env src/tests/record-all.ts
 * 
 * Token sources (in order):
 * 1. SPOTIFY_TOKEN environment variable
 * 2. Tauri store: ~/Library/Application Support/com.spx.app/spotify-auth.bin
 * 3. User prompt
 */

import { ensureDir } from "https://deno.land/std@0.200.0/fs/mod.ts";

const FIXTURES_DIR = "./src/tests/fixtures-real";
const BASE_URL = "https://api.spotify.com";

interface Endpoint {
  method: string;
  path: string;
  fixture: string;
  description: string;
  expectEmpty?: boolean;
}

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

// ─── Token Acquisition ─────────────────────────────────────────────────────────

async function getSpotfyToken(): Promise<string> {
  // 1. Try environment variable
  const envToken = Deno.env.get("SPOTIFY_TOKEN");
  if (envToken) {
    console.log("✓ Token found in SPOTIFY_TOKEN env var");
    return envToken;
  }

  // 2. Try Tauri store
  const storePaths = [
    `${Deno.env.get("HOME")}/Library/Application Support/com.spx.app/spotify-auth.bin`,
    `${Deno.env.get("HOME")}/.local/share/com.spx.app/spotify-auth.bin`,
  ];

  for (const storePath of storePaths) {
    try {
      const data = await Deno.readFile(storePath);
      // Binary format: [u8; 4] magic + JSON payload
      // Skip first 4 bytes if magic header
      let text: string;
      const view = new DataView(data.buffer);
      if (data.length > 4 && view.getUint32(0, true) === 0x53505800) {
        // SPX\0 magic - skip header
        text = new TextDecoder().decode(data.slice(4));
      } else {
        text = new TextDecoder().decode(data);
      }
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(text);
        if (parsed.access_token) {
          console.log(`✓ Token found in Tauri store: ${storePath}`);
          return parsed.access_token;
        }
      } catch {
        // Not JSON, try raw string
      }

      // Try base64 decode
      try {
        const decoded = atob(text.trim());
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) {
          console.log(`✓ Token found in Tauri store (base64): ${storePath}`);
          return parsed.access_token;
        }
      } catch {
        // Try extracting token directly
        const tokenMatch = text.match(/"access_token"\s*:\s*"([^"]+)"/);
        if (tokenMatch) {
          console.log(`✓ Token extracted from Tauri store: ${storePath}`);
          return tokenMatch[1];
        }
      }
    } catch {
      // File doesn't exist or can't be read
    }
  }

  // 3. Prompt user
  console.log("No token found. Please provide your Spotify access token:");
  console.log("  export SPOTIFY_TOKEN='your_token_here'");
  const token = prompt("Access token: ");
  if (!token) {
    throw new Error("No token provided");
  }
  return token;
}

function prompt(message: string): string | null {
  console.log(message);
  // For non-interactive use, return null
  return null;
}

// ─── API Fetching ──────────────────────────────────────────────────────────────

async function fetchEndpoint(token: string, endpoint: Endpoint): Promise<{ status: number; data: any }> {
  const url = BASE_URL + endpoint.path;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
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

// ─── Endpoints Configuration ───────────────────────────────────────────────────

const endpoints: Endpoint[] = [
  // User
  { method: "GET", path: "/v1/me", fixture: "user.json", description: "User profile" },
  
  // Playback state
  { method: "GET", path: "/v1/me/player", fixture: "playback.json", description: "Current playback state" },
  
  // Devices
  { method: "GET", path: "/v1/me/player/devices", fixture: "devices.json", description: "Available devices" },
  
  // Library
  { method: "GET", path: "/v1/me/playlists", fixture: "playlists.json", description: "User playlists" },
  { method: "GET", path: "/v1/me/tracks", fixture: "tracks.json", description: "Saved tracks" },
  { method: "GET", path: "/v1/me/albums", fixture: "albums.json", description: "Saved albums" },
  
  // Playback history
  { method: "GET", path: "/v1/me/player/recently-played?limit=50", fixture: "recent.json", description: "Recently played" },
  
  // Queue
  { method: "GET", path: "/v1/me/player/queue", fixture: "queue.json", description: "Current queue" },
  
  // Search
  { method: "GET", path: "/v1/search?q=test&type=track,artist,album,playlist&limit=5", fixture: "search.json", description: "Search" },
  
  // Player actions (expect errors)
  { method: "PUT", path: "/v1/me/player/play", fixture: "play-error.json", description: "Play (expect error)", expectEmpty: true },
  { method: "PUT", path: "/v1/me/player/pause", fixture: "pause-error.json", description: "Pause (expect error)", expectEmpty: true },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎙️  SPX API Recording Script (fixtures-real)");
  console.log("=".repeat(50));

  const token = await getSpotfyToken();
  console.log(`Token prefix: ${token.slice(0, 20)}...`);
  console.log("");

  await ensureDir(FIXTURES_DIR);

  const manifest: Manifest = {
    version: "1.0.0",
    recordedAt: new Date().toISOString(),
    tokenPrefix: token.slice(0, 20),
    endpoints: [],
  };

  for (const endpoint of endpoints) {
    const url = `${endpoint.method} ${endpoint.path}`;
    process.stdout.write(`Recording: ${url.padEnd(60)} `);

    try {
      const { status, data } = await fetchEndpoint(token, endpoint);
      const fixturePath = `${FIXTURES_DIR}/${endpoint.fixture}`;

      if (endpoint.expectEmpty && status !== 204) {
        // Save error response
        const errorData = {
          error: true,
          status,
          body: data || { message: "No content" }
        };
        await Deno.writeTextFile(fixturePath, JSON.stringify(errorData, null, 2));
        console.log(`⚠️  ${status} (error fixture saved)`);
      } else if (status === 204) {
        const emptyData = { _empty: true, status: 204 };
        await Deno.writeTextFile(fixturePath, JSON.stringify(emptyData, null, 2));
        console.log(`✅ ${status} (empty)`);
      } else if (status === 200 || status === 201) {
        await Deno.writeTextFile(fixturePath, JSON.stringify(data, null, 2));
        console.log(`✅ ${status}`);
      } else {
        const unexpectedData = { _unexpected: true, status, data };
        await Deno.writeTextFile(fixturePath, JSON.stringify(unexpectedData, null, 2));
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
  const manifestPath = `${FIXTURES_DIR}/manifest.json`;
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("");
  console.log("=".repeat(50));
  console.log(`✅ Recording complete!`);
  console.log(`📁 ${endpoints.length} fixtures saved to ${FIXTURES_DIR}/`);
  console.log(`📋 Manifest: ${manifestPath}`);
}

main().catch(console.error);
