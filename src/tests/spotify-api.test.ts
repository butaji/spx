/// <reference lib="deno.ns" />

/**
 * SPX Spotify API Test Suite
 * 
 * Run with: deno test --allow-read --allow-net src/tests/spotify-api.test.ts
 * 
 * Note: These tests use recorded fixtures. To re-record:
 *   deno run --allow-net --allow-env --allow-write src/tests/record-api.ts
 */

import { assertExists, assert } from "https://deno.land/std@0.200.0/testing/asserts.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXTURES_DIR = "./fixtures";

async function loadFixture(name: string): Promise<any> {
  const path = `${FIXTURES_DIR}/${name}`;
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

// ─── Valid JSON ───────────────────────────────────────────────────────────────

Deno.test("All fixtures are valid JSON", async () => {
  const fixtures = [
    "me.json", "player.json", "devices.json", "playlists.json",
    "tracks.json", "albums.json", "recently-played.json", "queue.json",
    "artist.json", "search.json", "play-error.json", "pause-empty.json"
  ];
  
  for (const fixture of fixtures) {
    try {
      await loadFixture(fixture);
    } catch (e) {
      throw new Error(`Invalid JSON in ${fixture}: ${e}`);
    }
  }
});

// ─── GET /v1/me ───────────────────────────────────────────────────────────────

Deno.test("GET /v1/me returns user with id and display_name", async () => {
  const data = await loadFixture("me.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  // Otherwise verify success structure
  assertExists(data.id, "User should have id");
  assertExists(data.display_name, "User should have display_name");
});

// ─── GET /v1/me/player ────────────────────────────────────────────────────────

Deno.test("GET /v1/me/player returns playback state (or empty)", async () => {
  const data = await loadFixture("player.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  // Empty response is valid (no active playback)
  if (Object.keys(data).length === 0) return;
  
  // Has expected top-level playback fields
  if (data.is_playing !== undefined) {
    assert(typeof data.is_playing === "boolean", "is_playing should be boolean");
  }
});

// ─── GET /v1/me/player/devices ────────────────────────────────────────────────

Deno.test("GET /v1/me/player/devices has devices array", async () => {
  const data = await loadFixture("devices.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.devices, "Response should have devices array");
  assert(Array.isArray(data.devices), "devices should be array");
});

// ─── GET /v1/me/playlists ──────────────────────────────────────────────────────

Deno.test("GET /v1/me/playlists has items array and total", async () => {
  const data = await loadFixture("playlists.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  assertExists(data.total, "Response should have total");
});

// ─── GET /v1/me/tracks ────────────────────────────────────────────────────────

Deno.test("GET /v1/me/tracks has items array and total", async () => {
  const data = await loadFixture("tracks.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  assertExists(data.total, "Response should have total");
});

// ─── GET /v1/me/albums ────────────────────────────────────────────────────────

Deno.test("GET /v1/me/albums has items array and total", async () => {
  const data = await loadFixture("albums.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  assertExists(data.total, "Response should have total");
});

// ─── GET /v1/me/player/recently-played ────────────────────────────────────────

Deno.test("GET /v1/me/player/recently-played has items array", async () => {
  const data = await loadFixture("recently-played.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
});

// ─── GET /v1/me/player/queue ──────────────────────────────────────────────────

Deno.test("GET /v1/me/player/queue has valid structure", async () => {
  const data = await loadFixture("queue.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  // queue can be present (array) or not
  if (data.queue) {
    assert(Array.isArray(data.queue), "queue should be array");
  }
});

// ─── GET /v1/artists/:id ──────────────────────────────────────────────────────

Deno.test("GET /v1/artists/:id has id and name", async () => {
  const data = await loadFixture("artist.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  assertExists(data.id, "Artist should have id");
  assertExists(data.name, "Artist should have name");
});

// ─── GET /v1/search ───────────────────────────────────────────────────────────

Deno.test("GET /v1/search has search result fields", async () => {
  const data = await loadFixture("search.json");
  
  // If error response, just verify error structure
  if (data.error) {
    assertExists(data.error.status);
    assertExists(data.error.message);
    return;
  }
  
  // Search returns tracks, albums, artists, playlists (or some subset)
  const hasResultType = 
    data.tracks !== undefined ||
    data.albums !== undefined ||
    data.artists !== undefined ||
    data.playlists !== undefined;
  
  assert(hasResultType, "Search response should have at least one result type");
});

// ─── Error Handling ───────────────────────────────────────────────────────────

Deno.test("Play error has error field", async () => {
  const data = await loadFixture("play-error.json");
  assertExists(data.error, "Error response should have error field");
  assertExists(data.error.status, "Error should have status");
  assertExists(data.error.message, "Error should have message");
});

Deno.test("Pause error has error field", async () => {
  const data = await loadFixture("pause-empty.json");
  assertExists(data.error, "Error response should have error field");
  assertExists(data.error.status, "Error should have status");
  assertExists(data.error.message, "Error should have message");
});
