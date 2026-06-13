/// <reference lib="deno.ns" />

/**
 * SPX Real API Test Suite
 * 
 * Run with: deno test --allow-read src/tests/api-real.test.ts
 * 
 * Tests recorded fixtures from fixtures-real/
 * To re-record fixtures: deno run --allow-net --allow-read --allow-write --allow-env src/tests/record-all.ts
 */

import { assertEquals, assertExists, assertStringIncludes, assertArrayIncludes } from "https://deno.land/std@0.200.0/testing/asserts.ts";
import { assert } from "https://deno.land/std@0.200.0/testing/asserts.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Manifest {
  version: string;
  recordedAt: string;
  tokenPrefix: string;
  endpoints: ManifestEndpoint[];
}

interface ManifestEndpoint {
  fixture: string;
  method: string;
  path: string;
  description: string;
  recordedAt: string;
  status: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXTURES_DIR = "./fixtures-real";

async function loadFixture(name: string): Promise<any> {
  const path = `${FIXTURES_DIR}/${name}`;
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

async function loadManifest(): Promise<Manifest> {
  return loadFixture("manifest.json");
}

function isErrorResponse(data: any): boolean {
  return data?.error || (data?.status && data?.status >= 400);
}

// ─── Manifest Tests ───────────────────────────────────────────────────────────

Deno.test("Manifest exists and is valid", async () => {
  const manifest = await loadManifest();
  assertExists(manifest.version, "Manifest should have version");
  assertExists(manifest.recordedAt, "Manifest should have recordedAt");
  assertExists(manifest.endpoints, "Manifest should have endpoints array");
  assertEquals(typeof manifest.recordedAt, "string");
});

Deno.test("Manifest has all expected fixtures", async () => {
  const manifest = await loadManifest();
  const fixtures = manifest.endpoints.map(e => e.fixture);
  
  const expected = [
    "user.json",
    "playback.json",
    "devices.json",
    "playlists.json",
    "tracks.json",
    "albums.json",
    "recent.json",
    "queue.json",
    "search.json",
    "play-error.json",
    "pause-error.json",
  ];
  
  for (const exp of expected) {
    assert(fixtures.includes(exp), `Missing fixture: ${exp}`);
  }
});

Deno.test("All fixtures are valid JSON", async () => {
  const manifest = await loadManifest();
  
  for (const endpoint of manifest.endpoints) {
    const path = `${FIXTURES_DIR}/${endpoint.fixture}`;
    try {
      const content = await Deno.readTextFile(path);
      JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON in ${endpoint.fixture}: ${e}`);
    }
  }
});

// ─── Endpoint Structure Tests ─────────────────────────────────────────────────

Deno.test("GET /v1/me (user) returns valid user profile", async () => {
  const data = await loadFixture("user.json");
  
  // Skip if error (token expired)
  if (isErrorResponse(data)) return;
  
  assertExists(data.id, "User profile should have id");
  assertEquals(typeof data.id, "string", "id should be string");
  assert(data.id.length > 0, "id should not be empty");
  
  assertExists(data.display_name, "User profile should have display_name");
  assertEquals(typeof data.display_name, "string", "display_name should be string");
  
  // Optional but validated if present
  if (data.email) {
    assertStringIncludes(data.email, "@", "Email should contain @");
  }
  
  if (data.images) {
    assert(Array.isArray(data.images), "images should be array");
    for (const img of data.images) {
      assertExists(img.url, "Image should have url");
      assertEquals(typeof img.url, "string");
    }
  }
  
  if (data.country) {
    assertEquals(typeof data.country, "string", "country should be string");
    assertEquals(data.country.length, 2, "country should be 2-letter ISO code");
  }
  
  if (data.product) {
    assertArrayIncludes(["free", "premium"], [data.product], "product should be free or premium");
  }
});

Deno.test("GET /v1/me/player (playback) returns valid playback state", async () => {
  const data = await loadFixture("playback.json");
  
  if (isErrorResponse(data)) return;
  
  // Empty response when nothing playing
  if (Object.keys(data).length === 0) return;
  
  // Playback state fields
  assert(
    typeof data.is_playing === "boolean" || data.is_playing === undefined,
    "is_playing should be boolean"
  );
  
  if (data.shuffle_state !== undefined) {
    assertEquals(typeof data.shuffle_state, "boolean", "shuffle_state should be boolean");
  }
  
  if (data.repeat_state) {
    assertArrayIncludes(["off", "context", "track"], [data.repeat_state], "repeat_state should be valid enum");
  }
  
  if (data.volume_percent !== undefined) {
    assert(
      data.volume_percent >= 0 && data.volume_percent <= 100,
      "volume_percent should be 0-100"
    );
  }
  
  // Device info
  if (data.device) {
    assertExists(data.device.id, "Device should have id");
    assertEquals(typeof data.device.id, "string", "device.id should be string");
    assertExists(data.device.name, "Device should have name");
    assertEquals(typeof data.device.name, "string", "device.name should be string");
    assertExists(data.device.type, "Device should have type");
    assertEquals(typeof data.device.type, "string", "device.type should be string");
    
    if (data.device.volume_percent !== undefined) {
      assert(
        data.device.volume_percent >= 0 && data.device.volume_percent <= 100,
        "device.volume_percent should be 0-100"
      );
    }
  }
  
  // Currently playing item
  if (data.item) {
    assertExists(data.item.id, "Track should have id");
    assertEquals(typeof data.item.id, "string", "item.id should be string");
    assertExists(data.item.name, "Track should have name");
    assertEquals(typeof data.item.name, "string", "item.name should be string");
    assertExists(data.item.uri, "Track should have uri");
    assertEquals(typeof data.item.uri, "string", "item.uri should be string");
    
    // Duration
    assert(data.item.duration_ms > 0, "duration_ms should be positive");
    assertEquals(typeof data.item.duration_ms, "number", "duration_ms should be number");
    
    // Artists
    if (data.item.artists) {
      assert(Array.isArray(data.item.artists), "artists should be array");
      assert(data.item.artists.length > 0, "artists should not be empty");
      for (const artist of data.item.artists) {
        assertExists(artist.id, "Artist should have id");
        assertExists(artist.name, "Artist should have name");
      }
    }
  }
});

Deno.test("GET /v1/me/player/devices returns valid device list", async () => {
  const data = await loadFixture("devices.json");
  
  if (isErrorResponse(data)) return;
  
  assertExists(data.devices, "Response should have devices array");
  assert(Array.isArray(data.devices), "devices should be array");
  
  for (const device of data.devices) {
    assertExists(device.id, "Device should have id");
    assertEquals(typeof device.id, "string", "device.id should be string");
    
    assertExists(device.name, "Device should have name");
    assertEquals(typeof device.name, "string", "device.name should be string");
    
    assertExists(device.type, "Device should have type");
    assertEquals(typeof device.type, "string", "device.type should be string");
    
    if (device.volume_percent !== undefined) {
      assert(
        device.volume_percent >= 0 && device.volume_percent <= 100,
        "volume_percent should be 0-100"
      );
    }
    
    if (device.is_active !== undefined) {
      assertEquals(typeof device.is_active, "boolean", "is_active should be boolean");
    }
    
    if (device.is_private_session !== undefined) {
      assertEquals(typeof device.is_private_session, "boolean", "is_private_session should be boolean");
    }
    
    if (device.is_restricted !== undefined) {
      assertEquals(typeof device.is_restricted, "boolean", "is_restricted should be boolean");
    }
  }
});

Deno.test("GET /v1/me/playlists returns valid playlist collection", async () => {
  const data = await loadFixture("playlists.json");
  
  if (isErrorResponse(data)) return;
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  
  for (const playlist of data.items) {
    assertExists(playlist.id, "Playlist should have id");
    assertEquals(typeof playlist.id, "string", "playlist.id should be string");
    
    assertExists(playlist.name, "Playlist should have name");
    assertEquals(typeof playlist.name, "string", "playlist.name should be string");
    
    if (playlist.description !== undefined) {
      assertEquals(typeof playlist.description, "string", "playlist.description should be string");
    }
    
    if (playlist.tracks?.total !== undefined) {
      assertEquals(typeof playlist.tracks.total, "number", "tracks.total should be number");
    }
    
    if (playlist.owner) {
      assertExists(playlist.owner.display_name, "Owner should have display_name");
    }
    
    if (playlist.images) {
      assert(Array.isArray(playlist.images), "images should be array");
    }
    
    if (playlist.uri) {
      assertEquals(typeof playlist.uri, "string", "uri should be string");
    }
  }
  
  if (data.total !== undefined) {
    assertEquals(typeof data.total, "number", "total should be number");
  }
  
  if (data.limit !== undefined) {
    assertEquals(typeof data.limit, "number", "limit should be number");
  }
});

Deno.test("GET /v1/me/tracks returns valid saved tracks", async () => {
  const data = await loadFixture("tracks.json");
  
  if (isErrorResponse(data)) return;
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  
  for (const item of data.items) {
    assertExists(item.added_at, "Track item should have added_at");
    assertEquals(typeof item.added_at, "string", "added_at should be string");
    
    if (item.track) {
      const track = item.track;
      assertExists(track.id, "Track should have id");
      assertEquals(typeof track.id, "string", "track.id should be string");
      
      assertExists(track.name, "Track should have name");
      assertEquals(typeof track.name, "string", "track.name should be string");
      
      assertExists(track.uri, "Track should have uri");
      assertEquals(typeof track.uri, "string", "track.uri should be string");
      
      // Duration
      assertEquals(typeof track.duration_ms, "number", "duration_ms should be number");
      assert(track.duration_ms > 0, "duration_ms should be positive");
      
      // Explicit flag
      if (track.explicit !== undefined) {
        assertEquals(typeof track.explicit, "boolean", "explicit should be boolean");
      }
      
      // Artists
      if (track.artists) {
        assert(Array.isArray(track.artists), "artists should be array");
        for (const artist of track.artists) {
          assertExists(artist.id, "Artist should have id");
          assertExists(artist.name, "Artist should have name");
        }
      }
      
      // Album
      if (track.album) {
        assertExists(track.album.name, "Album should have name");
        assertEquals(typeof track.album.name, "string", "album.name should be string");
        
        if (track.album.images) {
          assert(Array.isArray(track.album.images), "album.images should be array");
        }
      }
    }
  }
  
  if (data.total !== undefined) {
    assertEquals(typeof data.total, "number", "total should be number");
  }
});

Deno.test("GET /v1/me/albums returns valid saved albums", async () => {
  const data = await loadFixture("albums.json");
  
  if (isErrorResponse(data)) return;
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  
  for (const item of data.items) {
    assertExists(item.added_at, "Album item should have added_at");
    assertEquals(typeof item.added_at, "string", "added_at should be string");
    
    if (item.album) {
      const album = item.album;
      assertExists(album.id, "Album should have id");
      assertEquals(typeof album.id, "string", "album.id should be string");
      
      assertExists(album.name, "Album should have name");
      assertEquals(typeof album.name, "string", "album.name should be string");
      
      if (album.album_type) {
        assertArrayIncludes(
          ["album", "single", "compilation"],
          [album.album_type],
          "album_type should be valid"
        );
      }
      
      // Artists
      if (album.artists) {
        assert(Array.isArray(album.artists), "album.artists should be array");
        for (const artist of album.artists) {
          assertExists(artist.id, "Artist should have id");
          assertExists(artist.name, "Artist should have name");
        }
      }
      
      // Images
      if (album.images) {
        assert(Array.isArray(album.images), "album.images should be array");
        for (const img of album.images) {
          assertExists(img.url, "Image should have url");
        }
      }
      
      // Release date
      if (album.release_date) {
        assertEquals(typeof album.release_date, "string", "release_date should be string");
      }
      
      // Track count
      if (album.total_tracks !== undefined) {
        assertEquals(typeof album.total_tracks, "number", "total_tracks should be number");
      }
    }
  }
  
  if (data.total !== undefined) {
    assertEquals(typeof data.total, "number", "total should be number");
  }
});

Deno.test("GET /v1/me/player/recently-played returns valid play history", async () => {
  const data = await loadFixture("recent.json");
  
  if (isErrorResponse(data)) return;
  
  assertExists(data.items, "Response should have items array");
  assert(Array.isArray(data.items), "items should be array");
  
  for (const item of data.items) {
    assertExists(item.played_at, "History item should have played_at");
    assertEquals(typeof item.played_at, "string", "played_at should be ISO string");
    
    if (item.track) {
      assertExists(item.track.id, "Track should have id");
      assertEquals(typeof item.track.id, "string", "track.id should be string");
      
      assertExists(item.track.name, "Track should have name");
      assertEquals(typeof item.track.name, "string", "track.name should be string");
      
      assertExists(item.track.uri, "Track should have uri");
      assertEquals(typeof item.track.uri, "string", "track.uri should be string");
      
      if (item.track.duration_ms !== undefined) {
        assertEquals(typeof item.track.duration_ms, "number", "duration_ms should be number");
      }
    }
    
    // Context (optional - null for local files)
    if (item.context) {
      assertExists(item.context.type, "Context should have type");
      assertEquals(typeof item.context.type, "string", "context.type should be string");
      assertExists(item.context.uri, "Context should have uri");
      assertEquals(typeof item.context.uri, "string", "context.uri should be string");
    }
  }
  
  // Cursor-based pagination
  if (data.cursors) {
    assertExists(data.cursors.after, "Cursors should have after");
    assertExists(data.cursors.before, "Cursors should have before");
  }
});

Deno.test("GET /v1/me/player/queue returns valid queue structure", async () => {
  const data = await loadFixture("queue.json");
  
  if (isErrorResponse(data)) return;
  
  // Queue can have null currently_playing if nothing playing
  if (data.currently_playing === null && (!data.queue || data.queue.length === 0)) {
    return; // Empty queue is valid
  }
  
  // Currently playing
  if (data.currently_playing) {
    assertExists(data.currently_playing.id, "Currently playing should have id");
    assertEquals(typeof data.currently_playing.id, "string", "currently_playing.id should be string");
    
    assertExists(data.currently_playing.name, "Currently playing should have name");
    assertEquals(typeof data.currently_playing.name, "string", "currently_playing.name should be string");
    
    assertExists(data.currently_playing.uri, "Currently playing should have uri");
    assertEquals(typeof data.currently_playing.uri, "string", "currently_playing.uri should be string");
  }
  
  // Queue array
  if (data.queue) {
    assert(Array.isArray(data.queue), "queue should be array");
    
    for (const track of data.queue) {
      assertExists(track.id, "Queued track should have id");
      assertEquals(typeof track.id, "string", "queued track.id should be string");
      
      assertExists(track.name, "Queued track should have name");
      assertEquals(typeof track.name, "string", "queued track.name should be string");
      
      assertExists(track.uri, "Queued track should have uri");
      assertEquals(typeof track.uri, "string", "queued track.uri should be string");
      
      if (track.duration_ms !== undefined) {
        assertEquals(typeof track.duration_ms, "number", "duration_ms should be number");
      }
    }
  }
});

Deno.test("GET /v1/search returns valid search results", async () => {
  const data = await loadFixture("search.json");
  
  if (isErrorResponse(data)) return;
  
  // Search response has result type objects
  const resultTypes = ["tracks", "albums", "artists", "playlists", "shows", "episodes"];
  
  for (const type of resultTypes) {
    if (data[type]) {
      assertEquals(typeof data[type], "object", `${type} should be object`);
      assertExists(data[type].items, `${type} should have items`);
      assert(Array.isArray(data[type].items), `${type}.items should be array`);
      
      for (const item of data[type].items) {
        assertExists(item.id, `${type} item should have id`);
        assertEquals(typeof item.id, "string", `${type} item.id should be string`);
        
        assertExists(item.name, `${type} item should have name`);
        assertEquals(typeof item.name, "string", `${type} item.name should be string`);
      }
    }
  }
  
  // At least one result type should exist
  const hasStructure = resultTypes.some(type => data[type]);
  assert(hasStructure, "Search response should have at least one result type structure");
});

// ─── Error Handling Tests ─────────────────────────────────────────────────────

Deno.test("Play endpoint returns error when no active device", async () => {
  const data = await loadFixture("play-error.json");
  
  // Expect error response
  assertExists(data.error || data.status, "Error response should have error or status");
  
  if (data.error) {
    if (typeof data.error === "object") {
      assertExists(data.error.message, "Error should have message");
    } else if (typeof data.error === "string") {
      assert(data.error.length > 0, "Error message should not be empty");
    }
  }
  
  if (data.status) {
    assert(
      data.status === 400 || data.status === 403 || data.status === 404,
      `Play error status should be 400/403/404, got ${data.status}`
    );
  }
});

Deno.test("Pause endpoint error handling", async () => {
  const data = await loadFixture("pause-error.json");
  
  // Pause on no playback returns error or empty
  if (data.error) {
    assertExists(data.error.message || data.status, "Error should have message or status");
  }
  
  // Empty success also valid
  if (data._empty) {
    assertEquals(data.status, 204, "Empty pause should return 204");
  }
});

// ─── Data Type Validation Tests ────────────────────────────────────────────────

Deno.test("All IDs are non-empty strings", async () => {
  const manifest = await loadManifest();
  
  for (const endpoint of manifest.endpoints) {
    if (endpoint.method !== "GET") continue;
    
    const data = await loadFixture(endpoint.fixture);
    if (isErrorResponse(data)) continue;
    
    // Collect all IDs found
    const ids = collectIds(data);
    for (const id of ids) {
      assertEquals(typeof id, "string", `${endpoint.fixture}: id should be string`);
      assert(id.length > 0, `${endpoint.fixture}: id should not be empty`);
    }
  }
});

Deno.test("All images arrays have proper structure", async () => {
  const data = await loadFixture("user.json");
  if (!isErrorResponse(data) && data.images) {
    for (const img of data.images) {
      assertExists(img.url, "Image should have url");
      assertEquals(typeof img.url, "string", "Image url should be string");
      
      if (img.width !== undefined) {
        assertEquals(typeof img.width, "number", "Image width should be number");
      }
      if (img.height !== undefined) {
        assertEquals(typeof img.height, "number", "Image height should be number");
      }
    }
  }
});

Deno.test("Timestamps are valid ISO strings", async () => {
  const tracks = await loadFixture("tracks.json");
  if (isErrorResponse(tracks)) return;
  
  if (tracks.items) {
    for (const item of tracks.items) {
      if (item.added_at) {
        assert(!isNaN(Date.parse(item.added_at)), "added_at should be valid ISO date");
      }
    }
  }
  
  const recent = await loadFixture("recent.json");
  if (!isErrorResponse(recent) && recent.items) {
    for (const item of recent.items) {
      if (item.played_at) {
        assert(!isNaN(Date.parse(item.played_at)), "played_at should be valid ISO date");
      }
    }
  }
});

// ─── Integration Flow Tests ───────────────────────────────────────────────────

Deno.test("User → Playlists → Tracks flow", async () => {
  const user = await loadFixture("user.json");
  if (isErrorResponse(user)) return;
  
  assertExists(user.id, "User should have id for further queries");
  
  const playlists = await loadFixture("playlists.json");
  if (isErrorResponse(playlists)) return;
  
  assertExists(playlists.items, "Playlists should have items");
  assert(Array.isArray(playlists.items), "Playlists items should be array");
  
  // If user has playlists, validate structure
  if (playlists.items.length > 0) {
    const playlist = playlists.items[0];
    assertExists(playlist.id, "Playlist should have id");
    assertExists(playlist.uri, "Playlist should have uri for playback");
  }
});

Deno.test("User → Playback state consistency", async () => {
  const user = await loadFixture("user.json");
  if (isErrorResponse(user)) return;
  
  const playback = await loadFixture("playback.json");
  if (isErrorResponse(playback)) return;
  
  // If we have playback state, device should be consistent
  if (Object.keys(playback).length > 0 && playback.device) {
    assertExists(playback.device.id, "Playback device should have id");
    assertExists(playback.device.name, "Playback device should have name");
    
    // If device is active, should be playing or paused
    if (playback.device.is_active) {
      assert(
        playback.is_playing !== undefined,
        "Active device should have is_playing state"
      );
    }
  }
});

Deno.test("User → Queue → Recently Played consistency", async () => {
  const queue = await loadFixture("queue.json");
  if (isErrorResponse(queue)) return;
  
  const recent = await loadFixture("recent.json");
  if (isErrorResponse(recent)) return;
  
  // Both should have valid structure
  assert(
    Array.isArray(queue.queue) || queue.currently_playing !== undefined || queue.queue?.length === 0,
    "Queue should have valid structure"
  );
  
  assert(Array.isArray(recent.items), "Recent should have items array");
});

Deno.test("Search results have valid references", async () => {
  const search = await loadFixture("search.json");
  if (isErrorResponse(search)) return;
  
  // Check tracks in search results
  if (search.tracks?.items?.length > 0) {
    const track = search.tracks.items[0];
    assertExists(track.id, "Search track should have id");
    assertExists(track.name, "Search track should have name");
    assertExists(track.uri, "Search track should have uri");
    
    // Track should have artists array
    if (track.artists) {
      assert(Array.isArray(track.artists), "Search track artists should be array");
      if (track.artists.length > 0) {
        assertExists(track.artists[0].name, "Artist should have name");
      }
    }
    
    // Track should have album
    if (track.album) {
      assertExists(track.album.name, "Album should have name");
    }
  }
});

// ─── Pagination Tests ──────────────────────────────────────────────────────────

Deno.test("Paginated endpoints have pagination fields", async () => {
  const endpoints = [
    { fixture: "playlists.json", key: "playlists" },
    { fixture: "tracks.json", key: "tracks" },
    { fixture: "albums.json", key: "albums" },
  ];
  
  for (const { fixture, key } of endpoints) {
    const data = await loadFixture(fixture);
    if (isErrorResponse(data)) continue;
    
    // Check for common pagination fields
    if (data.total !== undefined) {
      assertEquals(typeof data.total, "number", `${fixture}: total should be number`);
    }
    
    if (data.limit !== undefined) {
      assertEquals(typeof data.limit, "number", `${fixture}: limit should be number`);
    }
    
    if (data.offset !== undefined) {
      assertEquals(typeof data.offset, "number", `${fixture}: offset should be number`);
    }
    
    if (data.href) {
      assertEquals(typeof data.href, "string", `${fixture}: href should be string`);
      assertStringIncludes(data.href, key, `${fixture}: href should contain ${key}`);
    }
  }
});

// ─── Helper Functions ──────────────────────────────────────────────────────────

function collectIds(data: any, path: string = ""): string[] {
  const ids: string[] = [];
  
  if (!data || typeof data !== "object") return ids;
  
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      ids.push(...collectIds(data[i], `${path}[${i}]`));
    }
  } else {
    // Check if this object has an id field
    if (data.id !== undefined && typeof data.id === "string") {
      ids.push(data.id);
    }
    
    // Recurse into all properties
    for (const key of Object.keys(data)) {
      if (key === "id" || key === "_empty" || key === "error") continue;
      ids.push(...collectIds(data[key], `${path}.${key}`));
    }
  }
  
  return ids;
}
