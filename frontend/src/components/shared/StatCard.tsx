import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  value: number | string;
  label: string;
  sublabel?: string;
  variant?: "default" | "warning" | "error";
}

export function StatCard({ icon, value, label, sublabel, variant = "default" }: StatCardProps) {
  return (
    <article
      className="stat-card"
      data-variant={variant}
      aria-label={`${label}: ${value}`}
    >
      <span className="stat-card-icon" aria-hidden="true">
        {icon}
      </span>
      <strong className="stat-card-value">{value}</strong>
      <span className="stat-card-label">{label}</span>
      {sublabel && <small className="stat-card-sublabel">{sublabel}</small>}
    </article>
  );
}
