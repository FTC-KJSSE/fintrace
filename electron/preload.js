/**
 * FinTrace Desktop - Preload Script
 * 
 * Secure context boundary for Electron renderer.
 * All FinTrace telemetry (HTTP endpoints and SSE trace streams) operates
 * seamlessly over standard localhost communication with the local Express instance.
 * No arbitrary Node, filesystem, or shell APIs are exposed.
 */

const { contextBridge } = require("electron");

// Expose minimal application metadata in a secure, read-only namespace
contextBridge.exposeInMainWorld("finTraceDesktop", {
  isElectron: true,
  platform: process.platform,
});
