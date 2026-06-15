import SPXIcon from "./SPX-icon.svg?url";

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "default" | "large" | "icon";
}

export default function Logo({ size = 48, className, variant = "default" }: LogoProps) {
  const src = variant === "large" ? "/logo-large.svg" 
    : variant === "icon" ? SPXIcon
    : "/logo.svg";
  
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
