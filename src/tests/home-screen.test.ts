/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.200.0/testing/asserts.ts";

Deno.test("Home.tsx uses lib-grid class for Recent section", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  assertStringIncludes(homeSource, 'className="lib-grid"', "Recent section should use lib-grid class");
});

Deno.test("Home.tsx Recent items use lib-item class", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  assertStringIncludes(homeSource, 'className="lib-item"', "Recent items should use lib-item class");
});

Deno.test("Home.tsx Recent items use lib-item-img class", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  assertStringIncludes(homeSource, 'className="lib-item-img"', "Recent items should use lib-item-img class");
});

Deno.test("Home.tsx Recent section does not use inline grid styles", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  // Extract the Recent section
  const recentMatch = homeSource.match(/Recent[\s\S]*?lib-grid[\s\S]*?\/div>\s*<\/div>/);
  assertExists(recentMatch, "Recent section with lib-grid should exist");
  const recentSection = recentMatch[0];
  // Should NOT have inline style with display: grid or grid-template-columns
  assertEquals(
    recentSection.includes('style={') && recentSection.includes('display: grid'),
    false,
    "Recent section should not use inline grid styles"
  );
  assertEquals(
    recentSection.includes('style={') && recentSection.includes('grid-template-columns'),
    false,
    "Recent section should not use inline grid-template-columns"
  );
});

Deno.test("Home.tsx uses same grid class as Library", async () => {
  const homeSource = await Deno.readTextFile("../screens/Home.tsx");
  const librarySource = await Deno.readTextFile("../screens/Library.tsx");
  
  // Both should use lib-grid
  assertStringIncludes(homeSource, 'className="lib-grid"', "Home should use lib-grid");
  assertStringIncludes(librarySource, 'className="lib-grid"', "Library should use lib-grid");
});
