import { useState, useEffect } from "preact/hooks";
import { getTopArtists, getTopTracks } from "../lib/spotify";
import { Artwork } from "../components/Artwork";
import { IconFlame } from "../components/icons";

interface TopArtist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
}

interface TopTrack {
  id: string;
  name: string;
  artists?: Array<{ id: string; name: string }>;
  album?: {
    id: string;
    name: string;
    images?: Array<{ url: string }>;
  };
}

export default function Stats() {
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [artists, tracks] = await Promise.all([
          getTopArtists(5, "medium_term"),
          getTopTracks(5, "medium_term"),
        ]);
        setTopArtists(artists.slice(0, 5));
        setTopTracks(tracks.slice(0, 5));
      } catch (e) {
        console.error("Failed to load stats", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading stats...</div>;
  }

  return (
    <div className="stats-screen">
      <h1 className="screen-title">Your Stats</h1>

      <div className="stats-grid">
        <section className="stats-section">
          <h2 className="stats-section-title">
            <IconFlame /> Top Artists
          </h2>
          <div className="stats-list">
            {topArtists.map((artist, i) => (
              <div key={artist.id} className="stats-item">
                <span className="stats-rank">{i + 1}</span>
                <Artwork src={artist.images?.[0]?.url} size={40} shape="round" />
                <span className="stats-name">{artist.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-section">
          <h2 className="stats-section-title">
            <IconFlame /> Top Tracks
          </h2>
          <div className="stats-list">
            {topTracks.map((track, i) => (
              <div key={track.id} className="stats-item">
                <span className="stats-rank">{i + 1}</span>
                <Artwork src={track.album?.images?.[0]?.url} size={40} />
                <div className="stats-track-info">
                  <span className="stats-name">{track.name}</span>
                  <span className="stats-artist">{track.artists?.map(a => a.name).join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
