import { useState } from "preact/hooks";

interface ArtworkProps {
  src?: string | null;
  alt?: string;
  size?: number | "small" | "medium" | "large" | "hero";
  shape?: "square" | "round";
  className?: string;
  onClick?: () => void;
}

const sizes = {
  small: 32,
  medium: 40,
  large: 64,
  hero: 160,
};

export function Artwork({ src, alt = "", size = "medium", shape = "square", className = "", onClick }: ArtworkProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const pixelSize = typeof size === "number" ? size : sizes[size];
  const borderRadius = shape === "round" ? "50%" : "var(--radius-sm)";

  const style = {
    width: pixelSize,
    height: pixelSize,
    borderRadius,
    overflow: "hidden",
    flexShrink: 0,
    background: "var(--bg-elevated)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!src || error) {
    return (
      <div className={`artwork-placeholder ${className}`} style={style}>
        <svg width={pixelSize * 0.4} height={pixelSize * 0.4} viewBox="0 0 24 24" fill="none" stroke="var(--fg-faint)" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13M9 18c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zM21 16c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`artwork ${loaded ? "loaded" : ""} ${className}`}
      style={style}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      onClick={onClick}
    />
  );
}
