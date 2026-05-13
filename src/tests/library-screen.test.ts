/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.200.0/testing/asserts.ts";

Deno.test("Library.tsx uses lib-grid class for playlist/album grid", async () => {
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  assertStringIncludes(librarySource, 'className="lib-grid"', "Library grid should use lib-grid class");
});

Deno.test("Library.tsx playlist/album items use lib-item class", async () => {
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  assertStringIncludes(librarySource, 'className="lib-item"', "Library items should use lib-item class");
});

Deno.test("Library.tsx items use lib-item-img class for images", async () => {
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  assertStringIncludes(librarySource, 'className="lib-item-img"', "Library items should use lib-item-img class");
});

Deno.test("Library.tsx does not use inline grid styles for playlists/albums", async () => {
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  // Extract the playlists/albums grid section - from lib-grid to closing ) :
  const gridMatch = librarySource.match(/<div className="lib-grid">[\s\S]*?<\/div>\s*\)\s*:/);
  assertExists(gridMatch, "Library grid section should exist");
  const gridSection = gridMatch[0];
  // Should NOT have inline style with display: grid or grid-template-columns
  assertEquals(
    gridSection.includes('style={') && gridSection.includes('display: grid'),
    false,
    "Library grid should not use inline display: grid styles"
  );
  assertEquals(
    gridSection.includes('style={') && gridSection.includes('grid-template-columns'),
    false,
    "Library grid should not use inline grid-template-columns styles"
  );
});

Deno.test("Library.tsx grid items are 160x160 via CSS class", async () => {
  const css = await Deno.readTextFile("../styles/modern.css");
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  
  // Verify CSS defines the 160x160 dimensions
  const libItemImgMatch = css.match(/\.lib-item-img\s*\{([^}]+)\}/);
  assertExists(libItemImgMatch, "lib-item-img CSS rule should exist");
  assertStringIncludes(libItemImgMatch[1], "width: 160px", "lib-item-img should have width: 160px");
  assertStringIncludes(libItemImgMatch[1], "height: 160px", "lib-item-img should have height: 160px");
  
  // Verify Library.tsx uses lib-item-img
  assertStringIncludes(librarySource, 'className="lib-item-img"', "Library items should use lib-item-img class");
});

Deno.test("Library.tsx and Home.tsx use same grid classes", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  
  // Both use lib-grid
  assertStringIncludes(homeSource, 'className="lib-grid"', "Home should use lib-grid");
  assertStringIncludes(librarySource, 'className="lib-grid"', "Library should use lib-grid");
  
  // Both use lib-item
  assertStringIncludes(homeSource, 'className="lib-item"', "Home should use lib-item");
  assertStringIncludes(librarySource, 'className="lib-item"', "Library should use lib-item");
  
  // Both use lib-item-img
  assertStringIncludes(homeSource, 'className="lib-item-img"', "Home should use lib-item-img");
  assertStringIncludes(librarySource, 'className="lib-item-img"', "Library should use lib-item-img");
});
