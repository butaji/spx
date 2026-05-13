/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.200.0/testing/asserts.ts";
import { formatTime } from "../lib/utils.ts";

Deno.test("formatTime handles 0", () => assertEquals(formatTime(0), "0:00"));
Deno.test("formatTime handles undefined", () => assertEquals(formatTime(undefined), "0:00"));
Deno.test("formatTime handles NaN", () => assertEquals(formatTime(NaN), "0:00"));
Deno.test("formatTime handles seconds", () => assertEquals(formatTime(42000), "0:42"));
Deno.test("formatTime handles minutes", () => assertEquals(formatTime(186000), "3:06"));
Deno.test("formatTime handles hours", () => assertEquals(formatTime(3661000), "61:01"));