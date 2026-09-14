import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startServer, stopServer } from "../backend/server.js";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ statusCode: res.statusCode, data: body });
          }
        });
      })
      .on("error", reject);
  });
}

describe("Server Lifecycle & Dynamic Port Binding", () => {
  test("starts server on dynamic port (port: 0), responds to health probe, and shuts down cleanly", async () => {
    // 1. Start server on ephemeral port
    const instance = await startServer({ port: 0, host: "127.0.0.1" });
    assert.ok(instance.port > 0, `Server port should be assigned dynamically (got ${instance.port})`);
    assert.equal(instance.host, "127.0.0.1");

    // 2. Health check endpoint probe
    const healthRes = await fetchJson(`${instance.url}/api/health`);
    assert.equal(healthRes.statusCode, 200);
    assert.deepEqual(healthRes.data, { status: "ok" });

    // 3. Endpoints list probe
    const epRes = await fetchJson(`${instance.url}/api/endpoints`);
    assert.equal(epRes.statusCode, 200);
    assert.ok(Array.isArray(epRes.data));
    assert.ok(epRes.data.length >= 8, "Expected at least 8 curated financial endpoints");
    assert.ok(epRes.data.some((e) => e.id === "binance"));

    // 4. Graceful stop
    await instance.close();

    // 5. Verify port is released (subsequent connection to old port should fail)
    await assert.rejects(
      () => fetchJson(`${instance.url}/api/health`),
      /ECONNREFUSED|ECONNRESET/i,
      "Connecting to closed server port should fail with ECONNREFUSED or ECONNRESET"
    );
  });
});
