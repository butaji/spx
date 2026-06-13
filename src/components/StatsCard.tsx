interface ContextCardProps {
  albumName?: string;
  contextLabel?: string;
}

export default function ContextCard({
  albumName,
  contextLabel,
}: ContextCardProps) {
  // Only show if we have meaningful real data
  if (!albumName && !contextLabel) {
    return null;
  }

  return (
    <div className="context-card">
      {contextLabel && (
        <span className="context-label">{contextLabel}</span>
      )}
      {albumName && (
        <span className="context-value">
          From the album <strong>{albumName}</strong>
        </span>
      )}
    </div>
  );
}
