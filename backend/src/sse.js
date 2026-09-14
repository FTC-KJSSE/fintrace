export function initSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
}

export function sendSse(res, event, data) {
  if (!res || res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Suppress write errors on abruptly closed sockets
  }
}

/**
 * Sends a periodic SSE comment (": heartbeat\n\n") to prevent proxy idle disconnects.
 * SSE comments are ignored by browser EventSource handlers and don't trigger events.
 * Returns a cleanup function that clears the interval.
 */
export function startHeartbeat(res, intervalMs = 15000) {
  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(timer);
      return;
    }
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

