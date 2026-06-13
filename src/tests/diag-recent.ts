#!/usr/bin/env -S deno run --allow-net --allow-env

const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) { console.error("SPOTIFY_TOKEN required"); Deno.exit(1); }

async function api(path: string) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  return r.json();
}

const data = await api("/me/player/recently-played?limit=50");
const items = data.items || [];

console.log(`\nRecently played: ${items.length} tracks\n`);

const contexts = new Map<string, number>();
const samples: Record<string, any> = {};

for (const item of items) {
  const ctx = item.context;
  const key = ctx ? `${ctx.type}:${ctx.uri}` : "none";
  contexts.set(key, (contexts.get(key) || 0) + 1);
  if (!samples[key]) samples[key] = item;
}

const sorted = Array.from(contexts.entries())
  .sort((a, b) => b[1] - a[1]);

for (const [key, count] of sorted.slice(0, 15)) {
  const s = samples[key];
  console.log(`${count}x  ${key}`);
  console.log(`     track: ${s.track?.name} — ${s.track?.artists?.map((a:any)=>a.name).join(", ")}`);
  console.log(`     album: ${s.track?.album?.name}`);
  console.log("");
}
