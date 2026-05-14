import { useState, useEffect } from "preact/hooks";
import { getAudioFeatures } from "../lib/spotify";

interface AudioFeaturesProps {
  trackId: string;
}

interface AudioFeatures {
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
}

export function AudioFeatures({ trackId }: AudioFeaturesProps) {
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trackId) return;
    setLoading(true);
    getAudioFeatures(trackId)
      .then(setFeatures)
      .finally(() => setLoading(false));
  }, [trackId]);

  if (loading || !features) return null;

  const featuresList = [
    { name: "Energy", value: features.energy, color: "#ff4d4d" },
    { name: "Danceability", value: features.danceability, color: "#1DB954" },
    { name: "Valence", value: features.valence, color: "#1e90ff" },
    { name: "Acousticness", value: features.acousticness, color: "#ffd700" },
  ];

  return (
    <div className="audio-features">
      <div className="audio-features-title">Audio Profile</div>
      {featuresList.map(f => (
        <div key={f.name} className="audio-feature-row">
          <span className="audio-feature-name">{f.name}</span>
          <div className="audio-feature-bar">
            <div
              className="audio-feature-fill"
              style={{
                width: `${f.value * 100}%`,
                background: f.color
              }}
            />
          </div>
          <span className="audio-feature-value">{Math.round(f.value * 100)}</span>
        </div>
      ))}
    </div>
  );
}
