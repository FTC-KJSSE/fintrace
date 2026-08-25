import express from "express";
import cors from "cors";
import { ENDPOINTS, findEndpoint } from "./src/endpoints.js";
import { runTraceroute } from "./src/traceRunner.js";
import { geolocate } from "./src/geolocate.js";
import { initSse, sendSse } from "./src/sse.js";

const PORT = 3001;
const app = express();
app.use(cors());

// Hostnames/IPs only — no leading dash (so it can't be mistaken for a CLI
// flag by tracert/traceroute) and no shell metacharacters.
const HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,252})[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

app.get("/api/endpoints", (_req, res) => {
  res.json(ENDPOINTS);
});

app.get("/api/trace/:target", (req, res) => {
  const { target } = req.params;
  const endpoint = findEndpoint(target);
  const host = endpoint ? endpoint.host : req.query.host || target;

  if (!HOST_RE.test(host)) {
    res.status(400).json({ error: "Invalid host" });
    return;
  }

  initSse(res);
  sendSse(res, "start", { host, label: endpoint?.label ?? host });

  // Geolocation is throttled/queued and can resolve well after the
  // traceroute process itself has exited, so the stream can only close once
  // every in-flight lookup has settled — not as soon as onDone/onError fires.
  let pendingLookups = 0;
  let traceResult = null;

  function maybeFinish() {
    if (pendingLookups > 0 || !traceResult) return;
    if (traceResult.type === "error") {
      sendSse(res, "error", { message: traceResult.message });
    } else {
      sendSse(res, "done", {});
    }
    res.end();
  }

  const child = runTraceroute(host, {
    onHop: (hop) => {
      pendingLookups++;
      geolocate(hop.ip)
        .then((geo) => sendSse(res, "hop", { ...hop, geo }))
        .catch(() => sendSse(res, "hop", { ...hop, geo: null }))
        .finally(() => {
          pendingLookups--;
          maybeFinish();
        });
    },
    onError: (err) => {
      traceResult = { type: "error", message: err.message };
      maybeFinish();
    },
    onDone: () => {
      traceResult = { type: "done" };
      maybeFinish();
    },
  });

  req.on("close", () => {
    child.kill();
  });
});

app.listen(PORT, () => {
  console.log(`FinTrace backend listening on http://localhost:${PORT}`);
});
