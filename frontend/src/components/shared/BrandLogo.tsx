import type { CSSProperties } from "react";

type BrandLogoProps = {
  size?: number;
  className?: string;
  variant?: "dark" | "light" | "standalone";
  style?: CSSProperties;
};

export function BrandLogo({ size = 40, className = "", style }: BrandLogoProps) {
  return (
    <img
      src="/favicon.png"
      alt="Incalpaca FM Logo"
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        objectFit: "contain",
        flexShrink: 0,
        borderRadius: size > 40 ? "16px" : "10px",
        ...style,
      }}
    />
  );
}
