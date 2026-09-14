import { spawn } from "node:child_process";
import readline from "node:readline";

const IP_RE = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
const RTT_RE = /(\d+(?:\.\d+)?)\s*ms/g;

// Both `tracert -d` (Windows) and `traceroute -n` (mac/Linux) skip reverse
// DNS, so every hop line is "<index> <ip-or-*> <rtt-samples-or-*>..." in a
// slightly different shape per OS. One parser covers both shapes.
export function parseHopLine(line) {
  const trimmed = line.trim();
  const hopMatch = trimmed.match(/^(\d+)\s+(.*)$/);
  if (!hopMatch) return null;

  const hopIndex = parseInt(hopMatch[1], 10);
  const rest = hopMatch[2];

  const ipMatch = rest.match(IP_RE);
  const ip = ipMatch ? ipMatch[1] : null;

  const rttSamples = [...rest.matchAll(RTT_RE)].map((m) => parseFloat(m[1]));
  const rttMs = rttSamples.length
    ? Math.round((rttSamples.reduce((a, b) => a + b, 0) / rttSamples.length) * 10) / 10
    : null;

  const timedOut = !ip && rttSamples.length === 0;

  return { hopIndex, ip, rttMs, timedOut };
}

export const MAX_HOPS = 20;
export const TIMEOUT_MS_WIN = 1000;
export const TIMEOUT_S_UNIX = 1;
export const MAX_TRACE_TIMEOUT_MS = 60000; // 60s hard ceiling for traceroute process

const activeProcesses = new Set();

export function killChildProcess(child) {
  if (!child) return;
  activeProcesses.delete(child);

  if (child._watchdogTimer) {
    clearTimeout(child._watchdogTimer);
    child._watchdogTimer = null;
  }

  if (child.killed || child.exitCode !== null) return;

  if (process.platform === "win32") {
    try {
      if (typeof child.pid === "number") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" }).on("error", () => {
          try {
            child.kill();
          } catch {}
        });
      }
      child.kill();
    } catch {
      try {
        child.kill();
      } catch {}
    }
  } else {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
}

export function terminateAllTraces() {
  const procs = [...activeProcesses];
  activeProcesses.clear();
  for (const child of procs) {
    killChildProcess(child);
  }
}

export function _getActiveProcessesCount() {
  return activeProcesses.size;
}

// Ensure all spawned trace processes terminate on backend shutdown
process.on("SIGINT", () => terminateAllTraces());
process.on("SIGTERM", () => terminateAllTraces());
process.on("exit", () => terminateAllTraces());

function commandFor(host) {
  if (process.platform === "win32") {
    return { cmd: "tracert", args: ["-d", "-h", String(MAX_HOPS), "-w", String(TIMEOUT_MS_WIN), host] };
  }
  return { cmd: "traceroute", args: ["-n", "-m", String(MAX_HOPS), "-w", String(TIMEOUT_S_UNIX), host] };
}

/**
 * Spawns the OS traceroute command and streams parsed hops as they arrive.
 * Returns the child process so the caller can kill it on client disconnect.
 */
export function runTraceroute(host, { onHop, onError, onDone, timeoutMs = MAX_TRACE_TIMEOUT_MS }) {
  const { cmd, args } = commandFor(host);
  const child = spawn(cmd, args);
  activeProcesses.add(child);

  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const hop = parseHopLine(line);
    if (hop && onHop) onHop(hop);
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  let rlClosed = false;
  let exitCode = null;
  let settled = false;

  function finish() {
    if (settled || !rlClosed || exitCode === null) return;
    settled = true;
    if (child._watchdogTimer) {
      clearTimeout(child._watchdogTimer);
      child._watchdogTimer = null;
    }
    activeProcesses.delete(child);
    try {
      rl.close();
    } catch {}

    if (exitCode !== 0 && stderrBuf.trim()) {
      onError?.(new Error(stderrBuf.trim()));
    } else {
      onDone?.();
    }
  }

  // Hard execution timeout guard to prevent indefinitely hanging tracert processes
  child._watchdogTimer = setTimeout(() => {
    if (!settled) {
      settled = true;
      activeProcesses.delete(child);
      killChildProcess(child);
      try {
        rl.close();
      } catch {}
      onError?.(new Error(`Traceroute execution timed out after ${timeoutMs / 1000}s`));
    }
  }, timeoutMs);

  child.on("error", (err) => {
    if (settled) return;
    settled = true;
    if (child._watchdogTimer) {
      clearTimeout(child._watchdogTimer);
      child._watchdogTimer = null;
    }
    activeProcesses.delete(child);
    try {
      rl.close();
    } catch {}
    onError?.(err.code === "ENOENT" ? new Error(`${cmd} not found on this system`) : err);
  });

  rl.on("close", () => {
    rlClosed = true;
    finish();
  });

  child.on("close", (code) => {
    exitCode = code ?? 0;
    finish();
  });

  return child;
}

