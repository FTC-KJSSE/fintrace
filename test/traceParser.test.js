import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseHopLine } from "../backend/src/traceRunner.js";

describe("Traceroute Hop Line Parser", () => {
  test("parses standard Windows tracert line with 3 RTT samples", () => {
    const line = "  1     2 ms     1 ms     2 ms  192.168.1.1";
    const hop = parseHopLine(line);
    assert.deepEqual(hop, {
      hopIndex: 1,
      ip: "192.168.1.1",
      rttMs: 1.7,
      timedOut: false,
    });
  });

  test("parses Windows tracert line with sub-millisecond samples (<1 ms)", () => {
    const line = "  2     1 ms    <1 ms     1 ms  10.0.0.1";
    const hop = parseHopLine(line);
    assert.equal(hop.hopIndex, 2);
    assert.equal(hop.ip, "10.0.0.1");
    assert.equal(hop.timedOut, false);
    assert.ok(typeof hop.rttMs === "number");
  });

  test("parses public intermediate hop with variable latency", () => {
    const line = "  7    28 ms    29 ms    28 ms  115.112.0.1";
    const hop = parseHopLine(line);
    assert.deepEqual(hop, {
      hopIndex: 7,
      ip: "115.112.0.1",
      rttMs: 28.3,
      timedOut: false,
    });
  });

  test("parses timeout line with asterisks", () => {
    const line = "  4     *        *        *     Request timed out.";
    const hop = parseHopLine(line);
    assert.deepEqual(hop, {
      hopIndex: 4,
      ip: null,
      rttMs: null,
      timedOut: true,
    });
  });

  test("parses line with partial timeouts but responding IP", () => {
    const line = "  5     *       42 ms     *     182.79.255.4";
    const hop = parseHopLine(line);
    assert.deepEqual(hop, {
      hopIndex: 5,
      ip: "182.79.255.4",
      rttMs: 42,
      timedOut: false,
    });
  });

  test("ignores non-hop header or footer lines", () => {
    const headerLines = [
      "Tracing route to ec2.ap-south-1.amazonaws.com [13.232.0.1]",
      "over a maximum of 20 hops:",
      "",
      "Trace complete.",
    ];

    for (const line of headerLines) {
      const hop = parseHopLine(line);
      assert.equal(hop, null, `Header line should parse as null: ${line}`);
    }
  });
});
