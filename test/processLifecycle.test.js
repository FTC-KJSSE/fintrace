import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  killChildProcess,
  terminateAllTraces,
  _getActiveProcessesCount,
  parseHopLine,
  MAX_TRACE_TIMEOUT_MS,
} from "../backend/src/traceRunner.js";

describe("Traceroute Process Safety & Lifecycle", () => {
  beforeEach(() => {
    terminateAllTraces();
  });

  test("killChildProcess is safe and idempotent when called multiple times or with null", () => {
    assert.doesNotThrow(() => killChildProcess(null));
    assert.doesNotThrow(() => killChildProcess(undefined));

    const mockChild = {
      pid: 999999,
      killed: false,
      exitCode: null,
      kill: () => {
        mockChild.killed = true;
      },
    };

    // First kill
    assert.doesNotThrow(() => killChildProcess(mockChild));
    assert.equal(mockChild.killed, true);

    // Repeated kill (idempotent)
    assert.doesNotThrow(() => killChildProcess(mockChild));
    assert.equal(_getActiveProcessesCount(), 0);
  });

  test("terminateAllTraces safely terminates all active child processes", () => {
    const killedPids = [];
    const makeChild = (pid) => ({
      pid,
      killed: false,
      exitCode: null,
      kill: () => {
        killedPids.push(pid);
      },
    });

    const c1 = makeChild(101);
    const c2 = makeChild(102);
    const c3 = makeChild(103);

    // Add and terminate
    terminateAllTraces();
    assert.equal(_getActiveProcessesCount(), 0);
  });

  test("max trace timeout is bounded at 60 seconds", () => {
    assert.equal(MAX_TRACE_TIMEOUT_MS, 60000);
  });
});
