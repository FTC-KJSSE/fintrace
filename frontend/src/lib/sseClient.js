import { API_BASE } from "../config/endpoints.js";

/**
 * Opens one traceroute SSE stream. The backend closes the HTTP response after
 * "done"/"error", but native EventSource auto-reconnects on any connection
 * close — so we explicitly .close() there to stop it from re-triggering a
 * fresh traceroute on the server.
 */
export function openTrace(target, { onStart, onHop, onDone, onError } = {}) {
  const url = `${API_BASE}/api/trace/${encodeURIComponent(target)}`;
  const source = new EventSource(url);

  source.addEventListener("start", (e) => onStart?.(JSON.parse(e.data)));
  source.addEventListener("hop", (e) => onHop?.(JSON.parse(e.data)));
  source.addEventListener("done", (e) => {
    onDone?.(JSON.parse(e.data));
    source.close();
  });
  source.addEventListener("error", (e) => {
    const detail = e.data ? JSON.parse(e.data) : { message: "Connection lost" };
    onError?.(detail);
    source.close();
  });

  return source;
}
