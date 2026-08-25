export function latencyTier(rttMs) {
  if (rttMs == null) return "timeout";
  if (rttMs < 50) return "low";
  if (rttMs <= 150) return "medium";
  return "high";
}

export const TIER_COLOR = {
  low: "#22c55e",
  medium: "#f0a830",
  high: "#ef4444",
  timeout: "#8e959d",
};
