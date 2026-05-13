#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read

import { ensureDir } from "https://deno.land/std@0.200.0/fs/mod.ts";

const FIXTURES_DIR = "./fixtures-live";
const TOKEN = Deno.env.get("SPOTIFY_TOKEN");

const ENDPOINTS = [
  { name: "user", path: "/v1/me" },
  { name: "playback", path: "/v1/me/player" },
  { name: "devices", path: "/v1/me/player/devices" },
  { name: "recently-played", path: "/v1/me/player/recently-played?limit=50" },
  { name: "top-artists", path: "/v1/me/top/artists?limit=20&time_range=short_term" },
  { name: "top-tracks", path: "/v1/me/top/tracks?limit=20&time_range=short_term" },
  { name: "playlists", path: "/v1/me/playlists?limit=50" },
  { name: "featured-playlists", path: "/v1/browse/featured-playlists?limit=20" },
  { name: "recommendations", path: "/v1/recommendations?seed_artists=4Z8W4fKeB5YxbusRsdQVPb&limit=20" },
];

async function recordEndpoint(name: string, path: string) {
  const res = await fetch(`https://api.spotify.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  await Deno.writeTextFile(
    `${FIXTURES_DIR}/${name}.json`,
    JSON.stringify({ status: res.status, timestamp: new Date().toISOString(), data }, null, 2)
  );
  console.log(`✓ ${name}: ${res.status}`);
}

await ensureDir(FIXTURES_DIR);
for (const ep of ENDPOINTS) {
  await recordEndpoint(ep.name, ep.path);
}
console.log("Done! Recordings saved to", FIXTURES_DIR);
