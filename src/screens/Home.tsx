import { useEffect, useState } from "preact/compat";
import { getArtist, getArtistTopTracks } from "../lib/spotify";
import { loadRecentActivity, lastPlayedTrack } from "../stores/spotify";
import { View } from "../App";
import type { SpotifyArtist } from "../types";

import NowPlayingHero from "../components/NowPlayingHero";
import ContextCard from "../components/StatsCard";
import ArtistTopSongs from "../components/ArtistTopSongs";
import RecentGrid from "../components/RecentGrid";

const MOCK_TAGS = ["electro swing", "trip hop", "nu jazz", "chillout", "electronic"];

interface Props {
  track: any | null;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onNavigate: (v: View) => void;
  onSeek: (ms: number) => void;
  liked: boolean;
  onToggleLike: () => void | Promise<void>;
}

export default function Home({
  track,
  onPlayContext,
  onNavigate,
  liked,
  onToggleLike,
}: Props) {
  const [artistDetail, setArtistDetail] = useState<SpotifyArtist | null>(null);
  const [artistTopTracks, setArtistTopTracks] = useState<any[]>([]);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [, forceUpdate] = useState({});

  const displayTrack = track || lastPlayedTrack.value;

  /* Load data on mount */
  useEffect(() => {
    loadData();
  }, []);

  /* Fetch artist when track changes */
  useEffect(() => {
    setIsLoadingArtist(true);

    const artistId =
      track?.artistIds?.[0] ||
      track?.artists?.[0]?.id ||
      lastPlayedTrack.value?.artistId;

    if (!artistId) {
      setArtistDetail(null);
      setArtistTopTracks([]);
      setIsLoadingArtist(false);
      return;
    }

    Promise.all([
      getArtist(artistId),
      getArtistTopTracks(artistId).catch(() => null),
    ])
      .then(([artist, topTracks]) => {
        setArtistDetail(artist);
        setArtistTopTracks(topTracks?.tracks?.slice(0, 3) || []);
      })
      .catch((e) => {
        console.error("Failed to load artist:", e);
        setArtistDetail(null);
        setArtistTopTracks([]);
      })
      .finally(() => setIsLoadingArtist(false));
  }, [track?.id, lastPlayedTrack.value?.id]);

  const loadData = async () => {
    try {
      await loadRecentActivity();
      setFeedError(null);
    } catch (e) {
      console.error("[Home] Failed to load recent activity:", e);
      setFeedError("Failed to load recent activity. Try refreshing.");
    } finally {
      forceUpdate({});
    }
  };

  const tags = artistDetail?.genres?.slice(0, 5) || MOCK_TAGS;

  return (
    <div className="animate-in">
      <NowPlayingHero
        track={displayTrack}
        liked={liked}
        isLoading={isLoadingArtist}
        tags={tags}
        onToggleLike={onToggleLike}
      />

      <ContextCard
        albumName={displayTrack?.album || displayTrack?.albumName}
        contextLabel="Now Playing"
      />

      <ArtistTopSongs
        artist={artistDetail}
        topTracks={artistTopTracks}
        tags={tags}
      />

      {feedError && (
        <div style={{
          background: 'var(--glass)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginTop: 16,
          color: 'var(--fg-dim)',
          fontSize: 13,
        }}>
          {feedError}
        </div>
      )}

      <RecentGrid
        onNavigate={onNavigate}
        onPlayContext={onPlayContext}
      />
    </div>
  );
}
