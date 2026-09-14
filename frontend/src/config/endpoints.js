export const API_BASE = (import.meta.env?.VITE_API_BASE ?? "").replace(/\/$/, "");

export async function fetchEndpoints() {
  const res = await fetch(`${API_BASE}/api/endpoints`);
  if (!res.ok) throw new Error("Failed to load endpoints");
  return res.json();
}

