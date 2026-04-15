import type { HealthStatus } from "../../types/repo";

export function healthColor(status: HealthStatus): string {
  switch (status) {
    case "active": return "#10B981";
    case "dormant": return "#F59E0B";
    case "dead": return "#EF4444";
    case "empty": return "#6B7280";
    case "archived": return "#8B5CF6";
    default: return "#6B7280";
  }
}

export function healthBg(status: HealthStatus): string {
  switch (status) {
    case "active": return "rgba(16,185,129,0.12)";
    case "dormant": return "rgba(245,158,11,0.12)";
    case "dead": return "rgba(239,68,68,0.12)";
    case "empty": return "rgba(107,114,128,0.12)";
    case "archived": return "rgba(139,92,246,0.12)";
    default: return "rgba(107,114,128,0.12)";
  }
}

export function healthBorder(status: HealthStatus): string {
  switch (status) {
    case "active": return "rgba(16,185,129,0.30)";
    case "dormant": return "rgba(245,158,11,0.30)";
    case "dead": return "rgba(239,68,68,0.30)";
    case "empty": return "rgba(107,114,128,0.25)";
    case "archived": return "rgba(139,92,246,0.30)";
    default: return "rgba(107,114,128,0.25)";
  }
}

export function healthLabel(status: HealthStatus): string {
  switch (status) {
    case "active": return "Active";
    case "dormant": return "Dormant";
    case "dead": return "Dead";
    case "empty": return "Empty";
    case "archived": return "Archived";
    default: return "Unknown";
  }
}


export function computeHealthStatus(pushedAt: string | null, size: number): HealthStatus {
  if (size === 0) return "empty";
  if (!pushedAt) return "dead";
  const daysSince = Math.floor((Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= 30) return "active";
  if (daysSince <= 180) return "dormant";
  return "dead";
}
