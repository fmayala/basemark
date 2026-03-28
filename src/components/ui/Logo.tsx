interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className = "" }: LogoProps) {
  const gradientId = `basemark-flow-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0.7"
          x2="1"
          y2="0.3"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="20%" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="40%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M5 18L10.2 7.5Q11 6 11.8 7.5L13.2 11Q14 12.5 14.8 11L19 6"
        stroke={`url(#${gradientId})`}
        strokeWidth={size < 20 ? "2.5" : size < 32 ? "2" : "1.8"}
      />
    </svg>
  );
}
