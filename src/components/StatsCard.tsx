interface StatsCardProps {
  artistName: string;
  trackName: string;
  scrobbleCount: number;
  trackScrobbleCount: number;
}

export default function StatsCard({
  artistName,
  trackName,
  scrobbleCount,
  trackScrobbleCount,
}: StatsCardProps) {
  return (
    <div
      style={{
        background: "var(--glass)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        marginTop: 16,
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-dim)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        You've listened to{" "}
        <strong style={{ color: "var(--fg)" }}>{artistName}</strong>{" "}
        {scrobbleCount.toLocaleString()} times and{" "}
        <strong style={{ color: "var(--fg)" }}>{trackName}</strong>{" "}
        {trackScrobbleCount.toLocaleString()} times.
      </p>
    </div>
  );
}
