interface LogoProps {
  size?: number;
  className?: string;
  variant?: "default" | "large";
}

export default function Logo({ size = 48, className, variant = "default" }: LogoProps) {
  const src = variant === "large" ? "/logo-large.svg" : "/logo.svg";
  
  return (
    <img
      src={src}
      width={size}
      height={size}
      class={className}
      alt="SPX"
      draggable={false}
    />
  );
}
