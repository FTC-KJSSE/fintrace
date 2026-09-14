import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { startServer, stopServer } from "../backend/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let serverInstance = null;
let isShuttingDown = false;

/**
 * Polls the local Express server /api/health endpoint until responsive.
 */
function waitForHealth(url, timeoutMs = 8000) {
  const startTime = Date.now();
  const healthUrl = `${url}/api/health`;

  return new Promise((resolve, reject) => {
    function probe() {
      const req = http.get(healthUrl, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => {
        retry();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Backend health check timed out after ${timeoutMs}ms at ${healthUrl}`));
      } else {
        setTimeout(probe, 150);
      }
    }

    probe();
  });
}

/**
 * Gracefully terminates the local Express backend and all child traceroute processes.
 */
async function shutdownBackend() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (serverInstance) {
    console.log("[FinTrace Desktop] Shutting down backend server and active processes...");
    try {
      await serverInstance.close();
    } catch (err) {
      console.error("[FinTrace Desktop] Error during server shutdown:", err);
    }
    serverInstance = null;
  }
}

/**
 * Initializes the main application window and starts the internal Express service.
 */
async function createWindow() {
  try {
    // 1. Start Express backend on a dynamic free local port (port: 0)
    console.log("[FinTrace Desktop] Starting local Express backend on dynamic port...");
    serverInstance = await startServer({ port: 0, host: "127.0.0.1", userDataDir: app.getPath("userData") });
    console.log(`[FinTrace Desktop] Backend listening on ${serverInstance.url}`);

    // 2. Await health check confirmation
    await waitForHealth(serverInstance.url);
    console.log("[FinTrace Desktop] Health check confirmed (/api/health OK)");

    // 3. Create BrowserWindow with hardened security
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1080,
      minHeight: 700,
      title: "FinTrace — Network Latency & Route Telemetry",
      backgroundColor: "#070b12",
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // 4. Reveal window once initial paint is ready
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    // 5. Load the local Express URL (which serves frontend/dist)
    await mainWindow.loadURL(serverInstance.url);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error("[FinTrace Desktop] Critical startup error:", err);
    dialog.showErrorBox(
      "FinTrace Desktop Startup Error",
      `Failed to initialize local FinTrace services:\n\n${err.message || err}`
    );
    await shutdownBackend();
    app.quit();
  }
}

// Ensure single instance lock for safety
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

// Lifecycle and cleanup handlers
let quitting = false;

app.on("before-quit", async (e) => {
  if (!quitting) {
    e.preventDefault();
    quitting = true;
    await shutdownBackend();
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("SIGINT", async () => {
  await shutdownBackend();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdownBackend();
  process.exit(0);
});
