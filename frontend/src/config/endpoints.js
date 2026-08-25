export const API_BASE = "http://localhost:3001";

export async function fetchEndpoints() {
  const res = await fetch(`${API_BASE}/api/endpoints`);
  if (!res.ok) throw new Error("Failed to load endpoints");
  return res.json();
}
