import { useEffect, useState } from "preact/compat";
import { getArtist, getArtistTopTracks } from "../lib/spotify";
import { loadRecentActivity, lastPlayedTrack } from "../stores/spotify";
import { View } from "../App";
import type { SpotifyArtist } from "../types";

import NowPlayingHero from "../components/NowPlayingHero";
import StatsCard from "../components/StatsCard";
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
  const [scrobbleCount, setScrobbleCount] = useState(0);
  const [trackScrobbleCount, setTrackScrobbleCount] = useState(0);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
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

  /* Generate mock scrobble counts */
  useEffect(() => {
    setScrobbleCount(Math.floor(Math.random() * 800) + 50);
    setTrackScrobbleCount(Math.floor(Math.random() * 50) + 5);
  }, [track?.id]);

  const loadData = async () => {
    await loadRecentActivity();
    forceUpdate({});
  };

  const artistName = displayTrack?.artistName || displayTrack?.artist || "Unknown";
  const trackName = displayTrack?.name || "Unknown Track";
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

      <StatsCard
        artistName={artistName}
        trackName={trackName}
        scrobbleCount={scrobbleCount}
        trackScrobbleCount={trackScrobbleCount}
      />

      <ArtistTopSongs
        artist={artistDetail}
        topTracks={artistTopTracks}
        tags={tags}
      />

      <RecentGrid
        onNavigate={onNavigate}
        onPlayContext={onPlayContext}
      />
    </div>
  );
}
