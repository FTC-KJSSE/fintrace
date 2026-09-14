import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ENDPOINTS, findEndpoint } from "./src/endpoints.js";
import { runTraceroute, killChildProcess, terminateAllTraces } from "./src/traceRunner.js";
import { geolocate } from "./src/geolocate.js";
import { initSse, sendSse, startHeartbeat } from "./src/sse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STATIC_DIR = path.resolve(__dirname, "../frontend/dist");

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "127.0.0.1";
const MAX_CONCURRENT_TRACES = 6;

const HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,252})[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const RESERVED_DOMAIN_SUFFIXES = [".local", ".internal", ".localhost", ".onion", ".lan", ".test", ".example", ".invalid", ".home", ".corp"];

export function validateTarget(host) {
  if (!host || typeof host !== "string") {
    return { valid: false, error: "Missing or invalid host parameter" };
  }

  const trimmed = host.trim();

  // Disallow IPv6 if attempted (unsupported by trace parser)
  if (trimmed.includes(":")) {
    return { valid: false, error: "IPv6 addresses are not supported" };
  }

  if (!HOST_RE.test(trimmed)) {
    return { valid: false, error: "Invalid hostname or IP syntax" };
  }

  // Check if it's an IPv4 address
  const ipMatch = trimmed.match(IPV4_RE);
  if (ipMatch) {
    const octets = [ipMatch[1], ipMatch[2], ipMatch[3], ipMatch[4]].map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      return { valid: false, error: "IPv4 octets must be between 0 and 255" };
    }

    const [o1, o2] = octets;

    // Reject loopback (127.0.0.0/8) & current network (0.0.0.0/8)
    if (o1 === 127 || o1 === 0) {
      return { valid: false, error: "Loopback and broadcast addresses are not allowed" };
    }

    // Reject RFC 1918 Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168)) {
      return { valid: false, error: "Private/internal RFC-1918 IP ranges are not allowed" };
    }

    // Reject Carrier-Grade NAT (100.64.0.0/10)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) {
      return { valid: false, error: "Carrier-Grade NAT IP addresses are not allowed" };
    }

    // Reject Link-Local (169.254.0.0/16)
    if (o1 === 169 && o2 === 254) {
      return { valid: false, error: "Link-local IP addresses are not allowed" };
    }

    // Reject Multicast / Reserved (224.0.0.0/4 and above)
    if (o1 >= 224) {
      return { valid: false, error: "Multicast or reserved IP addresses are not allowed" };
    }

    return { valid: true, host: trimmed };
  }

  // Domain name validation
  const lower = trimmed.toLowerCase();
  if (lower === "localhost") {
    return { valid: false, error: "Target 'localhost' is not allowed" };
  }

  if (!trimmed.includes(".")) {
    return { valid: false, error: "Target must be a public Fully Qualified Domain Name (FQDN) or public IP" };
  }

  if (RESERVED_DOMAIN_SUFFIXES.some((s) => lower.endsWith(s))) {
    return { valid: false, error: "Internal or reserved top-level domains are not allowed" };
  }

  return { valid: true, host: trimmed };
}

/**
 * Creates and configures the Express application instance.
 */
export function createApp(options = {}) {
  const app = express();
  app.use(cors());

  let activeTraceCount = 0;

  // Health check endpoint for readiness probing
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Endpoints list
  app.get("/api/endpoints", (_req, res) => {
    res.json(ENDPOINTS);
  });

  // SSE Trace endpoint
  app.get("/api/trace/:target", (req, res) => {
    const { target } = req.params;
    const endpoint = findEndpoint(target);
    const rawHost = endpoint ? endpoint.host : req.query.host || target;

    const validation = validateTarget(rawHost);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (activeTraceCount >= MAX_CONCURRENT_TRACES) {
      res.status(429).json({ error: `Maximum concurrent traces (${MAX_CONCURRENT_TRACES}) reached. Please wait for ongoing traces to complete.` });
      return;
    }

    const host = validation.host;
    activeTraceCount++;

    initSse(res);
    sendSse(res, "start", { host, label: endpoint?.label ?? host });
    const stopHeartbeat = startHeartbeat(res);

    let pendingLookups = 0;
    let traceResult = null;
    let cleanedUp = false;

    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      activeTraceCount = Math.max(0, activeTraceCount - 1);
      stopHeartbeat();
      killChildProcess(child);
    }

    function maybeFinish() {
      if (pendingLookups > 0 || !traceResult) return;
      if (traceResult.type === "error") {
        sendSse(res, "error", { message: traceResult.message });
      } else {
        sendSse(res, "done", {});
      }
      cleanup();
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
      cleanup();
    });
  });

  // Serve static production build if available
  const staticDir = options.staticDir ?? DEFAULT_STATIC_DIR;
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}

/**
 * Starts the FinTrace backend server.
 * Returns a promise resolving to the server instance with port, host, url, and close handler.
 */
export function startServer(options = {}) {
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? DEFAULT_HOST;
  const app = createApp(options);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const actualHost = typeof address === "object" && address ? address.address : host;
      const url = `http://${actualHost}:${actualPort}`;

      resolve({
        app,
        server,
        port: actualPort,
        host: actualHost,
        url,
        close: () => stopServer(server),
      });
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Cleanly stops the server and terminates any active child processes.
 */
export function stopServer(server) {
  return new Promise((resolve) => {
    terminateAllTraces();
    if (!server || !server.close) {
      resolve();
      return;
    }
    server.close(() => {
      resolve();
    });
  });
}

// Auto-start server when executed directly as CLI script
const isDirectExecution = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1].endsWith("server.js") ||
  process.argv[1].endsWith("server")
);

if (isDirectExecution) {
  startServer()
    .then(({ url }) => {
      console.log(`FinTrace backend listening on ${url}`);
    })
    .catch((err) => {
      console.error("Failed to start FinTrace backend:", err);
      process.exit(1);
    });
}


