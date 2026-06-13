/// <reference lib="deno.ns" />

import { assertExists } from "https://deno.land/std@0.200.0/testing/asserts.ts";

Deno.test("personalized home feed structure", async () => {
  const topArtists = JSON.parse(await Deno.readTextFile("./fixtures-live/top-artists.json"));
  const recent = JSON.parse(await Deno.readTextFile("./fixtures-live/recently-played.json"));
  const recommendations = JSON.parse(await Deno.readTextFile("./fixtures-live/recommendations.json"));
  
  assertExists(topArtists.data.items);
  assertExists(recent.data.items);
  assertExists(recommendations.data.tracks);
  
  // Verify we can generate radio seeds from top artists
  const seeds = topArtists.data.items.slice(0, 5).map((a: any) => a.id);
  console.log("Radio seeds:", seeds);
});
