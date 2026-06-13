#!/usr/bin/env -S deno run --allow-net --allow-env
const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) { console.error("SPOTIFY_TOKEN required"); Deno.exit(1); }
async function api(path: string) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t.slice(0,200)}`); }
  return r.json();
}

console.log("=== USER PLAYLISTS ===");
const pl = await api("/me/playlists?limit=50");
(pl.items || []).forEach((p: any) => console.log(`  ${p.name}`));

console.log("\n=== SAVED ALBUMS ===");
const sa = await api("/me/albums?limit=50");
(sa.items || []).forEach((i: any) => console.log(`  ${i.album?.name} — ${i.album?.artists?.map((a:any)=>a.name).join(", ")}`));

console.log("\n=== TOP ARTISTS (short_term) ===");
const ta = await api("/me/top/artists?limit=20&time_range=short_term");
(ta.items || []).forEach((a: any) => console.log(`  ${a.name}`));

console.log("\n=== FOLLOWED ARTISTS ===");
const fa = await api("/me/following?type=artist&limit=50");
(fa.artists?.items || []).forEach((a: any) => console.log(`  ${a.name}`));

console.log("\n=== TOP TRACKS (short_term) ===");
const tt = await api("/me/top/tracks?limit=20&time_range=short_term");
const albums = new Set<string>();
(tt.items || []).forEach((t: any) => {
  const a = t.album;
  if (a && !albums.has(a.id)) { albums.add(a.id); console.log(`  ${a.name} — ${t.artists?.map((a:any)=>a.name).join(", ")}`); }
});
