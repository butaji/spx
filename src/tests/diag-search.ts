#!/usr/bin/env -S deno run --allow-net --allow-env
const TOKEN = Deno.env.get("SPOTIFY_TOKEN");
if (!TOKEN) { console.error("SPOTIFY_TOKEN required"); Deno.exit(1); }
async function api(path: string) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t.slice(0,200)}`); }
  return r.json();
}
const targets = ["girl next door", "Handsome Boy Modeling School - Best Of"];
for (const q of targets) {
  console.log(`\n=== SEARCH: "${q}" ===`);
  const data = await api(`/search?q=${encodeURIComponent(q)}&type=album,playlist,artist&limit=3`);
  console.log("Albums:");
  (data.albums?.items || []).forEach((a: any) => console.log(`  ${a.name} — ${a.artists?.map((x: any) => x.name).join(", ")}`));
  console.log("Playlists:");
  (data.playlists?.items || []).forEach((p: any) => console.log(`  "${p?.name}" by ${p?.owner?.display_name || '?'}`));
  console.log("Artists:");
  (data.artists?.items || []).forEach((a: any) => console.log(`  ${a.name}`));
}
