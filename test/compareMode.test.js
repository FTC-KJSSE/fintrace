import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COMPARE_COLORS,
  MIN_COMPARE_TARGETS,
  MAX_COMPARE_TARGETS,
  validateCompareTargets,
  calculateCompareRanks,
  formatRankLabel,
  calculateCompareProgress,
  formatCompareStatus,
} from "../frontend/src/components/compare/compare.js";
import { MAX_CONCURRENT_TRACES } from "../backend/server.js";

describe("Compare Mode Expansion (2–6 Endpoints)", () => {
  test("defines 6 distinct vibrant colors and bounds [2, 6]", () => {
    assert.equal(MIN_COMPARE_TARGETS, 2);
    assert.equal(MAX_COMPARE_TARGETS, 6);
    assert.equal(COMPARE_COLORS.length, 6);
    const uniqueColors = new Set(COMPARE_COLORS);
    assert.equal(uniqueColors.size, 6, "All 6 compare colors must be unique");
  });

  test("accepts valid selections of 2, 3, 4, 5, and 6 endpoints", () => {
    const targets2 = ["nse", "bse"];
    const targets3 = ["nse", "bse", "nyse"];
    const targets4 = ["nse", "bse", "nyse", "nasdaq"];
    const targets5 = ["nse", "bse", "nyse", "nasdaq", "binance"];
    const targets6 = ["nse", "bse", "nyse", "nasdaq", "binance", "aws-ap-south-1"];

    [targets2, targets3, targets4, targets5, targets6].forEach((targets) => {
      const res = validateCompareTargets(targets);
      assert.equal(res.valid, true, `Targets of length ${targets.length} should be valid`);
      assert.deepEqual(res.targets, targets);
    });
  });

  test("rejects fewer than 2 targets", () => {
    const emptyRes = validateCompareTargets([]);
    assert.equal(emptyRes.valid, false);
    assert.match(emptyRes.error, /at least 2/i);

    const singleRes = validateCompareTargets(["nse"]);
    assert.equal(singleRes.valid, false);
    assert.match(singleRes.error, /at least 2/i);

    const nonArrayRes = validateCompareTargets(null);
    assert.equal(nonArrayRes.valid, false);
  });

  test("rejects 7th target (exceeding maximum 6 endpoints)", () => {
    const targets7 = ["nse", "bse", "nyse", "nasdaq", "binance", "aws-ap-south-1", "bloomberg"];
    const res = validateCompareTargets(targets7);
    assert.equal(res.valid, false);
    assert.match(res.error, /maximum of 6 endpoints/i);
  });

  test("rejects duplicate target selections", () => {
    const dupes = ["nse", "bse", "nse"];
    const res = validateCompareTargets(dupes);
    assert.equal(res.valid, false);
    assert.match(res.error, /duplicate endpoints detected/i);

    const dupes6 = ["nse", "bse", "nyse", "nasdaq", "binance", "binance"];
    const res6 = validateCompareTargets(dupes6);
    assert.equal(res6.valid, false);
    assert.match(res6.error, /duplicate endpoints detected/i);
  });

  test("calculates accurate ordinal rankings for 2 to 6 endpoints with ties and missing data", () => {
    const entries = [
      { id: "e1", label: "Endpoint 1", rttMs: 82.4 },
      { id: "e2", label: "Endpoint 2", rttMs: 14.2 },
      { id: "e3", label: "Endpoint 3", rttMs: 120.0 },
      { id: "e4", label: "Endpoint 4", rttMs: 14.2 }, // Tied for 1st
      { id: "e5", label: "Endpoint 5", rttMs: null },  // Evaluating / pending
      { id: "e6", label: "Endpoint 6", rttMs: 210.5 },
    ];

    const rankMap = calculateCompareRanks(entries);

    assert.equal(rankMap.get("e2"), "1", "e2 should be rank 1");
    assert.equal(rankMap.get("e4"), "1", "e4 tied with e2 should be rank 1");
    assert.equal(rankMap.get("e1"), "2", "e1 should be rank 2");
    assert.equal(rankMap.get("e3"), "3", "e3 should be rank 3");
    assert.equal(rankMap.get("e6"), "4", "e6 should be rank 4");
    assert.equal(rankMap.has("e5"), false, "e5 with null rtt should not have a numeric rank");

    assert.equal(formatRankLabel("1"), "1st (Fastest)");
    assert.equal(formatRankLabel("2"), "2nd");
    assert.equal(formatRankLabel("3"), "3rd");
    assert.equal(formatRankLabel("4"), "4th");
    assert.equal(formatRankLabel("5"), "5th");
    assert.equal(formatRankLabel("6"), "6th");
    assert.equal(formatRankLabel(null), "Evaluating…");
  });

  test("maintains independent route state and altitude offsets across 6 endpoints", () => {
    // Mimic RouteTracker logic for 6 endpoints
    const routes = new Map();
    for (let i = 0; i < 6; i++) {
      const id = `target-${i}`;
      routes.set(id, {
        id,
        slotIndex: i,
        color: COMPARE_COLORS[i],
        hops: [],
      });
    }

    // Add hops independently to route 0 and route 5
    routes.get("target-0").hops.push({ hopIndex: 1, rttMs: 5.0, ip: "1.1.1.1" });
    routes.get("target-5").hops.push({ hopIndex: 1, rttMs: 150.0, ip: "8.8.8.8" });

    assert.equal(routes.get("target-0").hops.length, 1);
    assert.equal(routes.get("target-1").hops.length, 0, "Route 1 must remain untouched");
    assert.equal(routes.get("target-5").hops.length, 1);

    // Verify arc altitude offsets prevent visual collision across 6 routes
    const distDeg = 45;
    const altitudes = [];
    for (let i = 0; i < 6; i++) {
      const baseAlt = Math.max(0.04, Math.min(0.24, (distDeg / 90) * 0.20));
      const segAltitude = baseAlt + i * 0.025;
      altitudes.push(segAltitude);
    }

    for (let i = 1; i < altitudes.length; i++) {
      assert.ok(altitudes[i] > altitudes[i - 1], `Altitude for slot ${i} must be higher than slot ${i - 1}`);
      assert.equal(Math.round((altitudes[i] - altitudes[i - 1]) * 1000) / 1000, 0.025);
    }
  });

  test("formatCompareStatus normalizes status strings accurately", () => {
    assert.equal(formatCompareStatus(null), "WAITING");
    assert.equal(formatCompareStatus(""), "WAITING");
    assert.equal(formatCompareStatus("waiting"), "WAITING");
    assert.equal(formatCompareStatus("idle"), "WAITING");
    assert.equal(formatCompareStatus("tracing"), "TRACING");
    assert.equal(formatCompareStatus("tracing…"), "TRACING");
    assert.equal(formatCompareStatus("done"), "COMPLETE");
    assert.equal(formatCompareStatus("complete"), "COMPLETE");
    assert.equal(formatCompareStatus("timeout"), "TIMEOUT");
    assert.equal(formatCompareStatus("timed out"), "TIMEOUT");
    assert.equal(formatCompareStatus("error: ECONNREFUSED"), "FAILED");
    assert.equal(formatCompareStatus("trace failed"), "FAILED");
  });

  test("calculateCompareProgress derives aggregate progress metrics for 2 to 6 routes", () => {
    // 2 routes - all waiting
    const p2Waiting = calculateCompareProgress([
      { id: "e1", status: "waiting" },
      { id: "e2", status: "waiting" },
    ]);
    assert.equal(p2Waiting.total, 2);
    assert.equal(p2Waiting.completed, 0);
    assert.equal(p2Waiting.waiting, 2);
    assert.equal(p2Waiting.isFinished, false);
    assert.equal(p2Waiting.summaryText, "COMPARE — 0/2 ROUTES COMPLETE");
    assert.equal(p2Waiting.progressBadge, "0/2");

    // 3 routes - 1 complete, 1 tracing, 1 waiting
    const p3InProgress = calculateCompareProgress([
      { id: "e1", status: "done" },
      { id: "e2", status: "tracing" },
      { id: "e3", status: "waiting" },
    ]);
    assert.equal(p3InProgress.total, 3);
    assert.equal(p3InProgress.completed, 1);
    assert.equal(p3InProgress.tracing, 1);
    assert.equal(p3InProgress.waiting, 1);
    assert.equal(p3InProgress.isFinished, false);
    assert.equal(p3InProgress.summaryText, "COMPARE — 1/3 ROUTES COMPLETE");
    assert.equal(p3InProgress.progressBadge, "1/3");

    // 4 routes - all complete
    const p4Done = calculateCompareProgress([
      { id: "e1", status: "done" },
      { id: "e2", status: "done" },
      { id: "e3", status: "done" },
      { id: "e4", status: "done" },
    ]);
    assert.equal(p4Done.total, 4);
    assert.equal(p4Done.completed, 4);
    assert.equal(p4Done.isFinished, true);
    assert.equal(p4Done.summaryText, "COMPARE COMPLETE — 4/4 ROUTES");
    assert.equal(p4Done.progressBadge, "4/4");

    // 5 routes - 4 complete, 1 failed
    const p5Mixed = calculateCompareProgress([
      { id: "e1", status: "done" },
      { id: "e2", status: "done" },
      { id: "e3", status: "done" },
      { id: "e4", status: "done" },
      { id: "e5", status: "error" },
    ]);
    assert.equal(p5Mixed.total, 5);
    assert.equal(p5Mixed.completed, 4);
    assert.equal(p5Mixed.failed, 1);
    assert.equal(p5Mixed.isFinished, true);
    assert.equal(p5Mixed.summaryText, "COMPARE COMPLETE — 4/5 ROUTES (1 FAILED)");
    assert.equal(p5Mixed.progressBadge, "4/5");

    // 6 routes - live in-progress state (4 complete, 2 tracing)
    const p6Live = calculateCompareProgress([
      { id: "e1", status: "done" },
      { id: "e2", status: "done" },
      { id: "e3", status: "done" },
      { id: "e4", status: "done" },
      { id: "e5", status: "tracing…" },
      { id: "e6", status: "tracing…" },
    ]);
    assert.equal(p6Live.total, 6);
    assert.equal(p6Live.completed, 4);
    assert.equal(p6Live.tracing, 2);
    assert.equal(p6Live.isFinished, false);
    assert.equal(p6Live.summaryText, "COMPARE — 4/6 ROUTES COMPLETE");
    assert.equal(p6Live.progressBadge, "4/6");
  });

  test("backend preserves MAX_CONCURRENT_TRACES = 6", () => {
    assert.equal(MAX_CONCURRENT_TRACES, 6, "Backend MAX_CONCURRENT_TRACES must remain 6");
  });
});
