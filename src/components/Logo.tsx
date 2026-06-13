interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 48, className }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      className={className}
      alt="SPX"
      draggable={false}
    />
  );
}
