/// <reference lib="deno.ns" />
import { assertExists, assertStringIncludes } from "https://deno.land/std@0.200.0/testing/asserts.ts";

const CSS_PATH = "../styles/modern.css";

Deno.test("lib-grid class exists in CSS", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  assertStringIncludes(css, ".lib-grid", "lib-grid class should exist in CSS");
});

Deno.test("lib-grid uses minmax(160px, 1fr) for stable columns", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  assertStringIncludes(css, "minmax(160px, 1fr)", "grid should use minmax(160px, 1fr)");
});

Deno.test("lib-grid has display: grid", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  assertStringIncludes(css, ".lib-grid", "lib-grid class should exist");
  // Check that lib-grid has display: grid
  const libGridMatch = css.match(/\.lib-grid\s*\{([^}]+)\}/);
  assertExists(libGridMatch, "lib-grid rule should exist");
  assertStringIncludes(libGridMatch[1], "display: grid", "lib-grid should have display: grid");
});

Deno.test("lib-item class exists in CSS", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  assertStringIncludes(css, ".lib-item", "lib-item class should exist in CSS");
});

Deno.test("lib-item-img has 160x160 dimensions", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  const libItemImgMatch = css.match(/\.lib-item-img\s*\{([^}]+)\}/);
  assertExists(libItemImgMatch, "lib-item-img rule should exist");
  const rules = libItemImgMatch[1];
  assertStringIncludes(rules, "width: 160px", "lib-item-img should have width: 160px");
  assertStringIncludes(rules, "height: 160px", "lib-item-img should have height: 160px");
});

Deno.test("lib-item-img has border-radius", async () => {
  const css = await Deno.readTextFile(CSS_PATH);
  const libItemImgMatch = css.match(/\.lib-item-img\s*\{([^}]+)\}/);
  assertExists(libItemImgMatch, "lib-item-img rule should exist");
  assertStringIncludes(libItemImgMatch[1], "border-radius", "lib-item-img should have border-radius");
});
