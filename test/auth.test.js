import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import {
  hashPassword,
  setupPassword,
  verifyPassword,
  isAuthSetup,
  getAuthStatus,
  lockSession,
  resetAuth,
  _setSessionUnlocked,
} from "../backend/src/auth.js";
import { startServer, stopServer } from "../backend/server.js";

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ statusCode: res.statusCode, data: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getJson(url) {
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

describe("Local Authentication & Security Guard", () => {
  let tempDir;
  let testAuthFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fintrace-auth-test-"));
    testAuthFile = path.join(tempDir, "auth.json");
    _setSessionUnlocked(false);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
    _setSessionUnlocked(false);
  });

  test("hashPassword generates salted PBKDF2 hash and never stores plaintext", () => {
    const pwd = "MasterPassword123!";
    const result = hashPassword(pwd);

    assert.ok(result.hash, "Must generate derived hash");
    assert.ok(result.salt, "Must generate random salt");
    assert.equal(result.algorithm, "sha512");
    assert.equal(result.iterations, 100000);
    assert.notEqual(result.hash, pwd, "Hash must not equal plaintext password");
    assert.ok(!JSON.stringify(result).includes(pwd), "Plaintext password must never appear in hash output");

    // Same password with different random salt produces different hash
    const result2 = hashPassword(pwd);
    assert.notEqual(result.salt, result2.salt, "Salts must be randomly generated");
    assert.notEqual(result.hash, result2.hash, "Hashes with distinct salts must differ");
  });

  test("first-time setup creates auth.json and unlocks session", () => {
    assert.equal(isAuthSetup(testAuthFile), false, "Initial state should not be setup");
    assert.deepEqual(getAuthStatus(testAuthFile), { isSetup: false, isUnlocked: false });

    // Rejects too-short passwords
    const shortRes = setupPassword("12", { filePath: testAuthFile });
    assert.equal(shortRes.success, false);

    // Valid setup
    const res = setupPassword("finTraceMaster#2026", { filePath: testAuthFile });
    assert.equal(res.success, true);
    assert.equal(isAuthSetup(testAuthFile), true);
    assert.deepEqual(getAuthStatus(testAuthFile), { isSetup: true, isUnlocked: true });

    // Verify stored file structure
    const raw = fs.readFileSync(testAuthFile, "utf-8");
    const stored = JSON.parse(raw);
    assert.ok(stored.hash);
    assert.ok(stored.salt);
    assert.ok(!raw.includes("finTraceMaster#2026"), "auth.json must never store plaintext password");
  });

  test("unlock verifies password against stored hash and rejects incorrect passwords", () => {
    setupPassword("TerminalSecret99", { filePath: testAuthFile });

    // Lock session
    lockSession();
    assert.deepEqual(getAuthStatus(testAuthFile), { isSetup: true, isUnlocked: false });

    // Incorrect password
    const failRes = verifyPassword("WrongPassword", { filePath: testAuthFile });
    assert.equal(failRes.success, false);
    assert.equal(failRes.error, "Incorrect password");
    assert.equal(getAuthStatus(testAuthFile).isUnlocked, false);

    // Correct password
    const successRes = verifyPassword("TerminalSecret99", { filePath: testAuthFile });
    assert.equal(successRes.success, true);
    assert.equal(getAuthStatus(testAuthFile).isUnlocked, true);
  });

  test("resetAuth removes auth.json and resets application to unconfigured state", () => {
    setupPassword("TemporaryPassword", { filePath: testAuthFile });
    assert.equal(isAuthSetup(testAuthFile), true);

    const resetRes = resetAuth({ filePath: testAuthFile });
    assert.equal(resetRes.success, true);
    assert.equal(isAuthSetup(testAuthFile), false);
    assert.deepEqual(getAuthStatus(testAuthFile), { isSetup: false, isUnlocked: false });
    assert.equal(fs.existsSync(testAuthFile), false);
  });

  test("HTTP API auth endpoints and trace guard integration", async () => {
    // Start backend server using isolated testAuthFile
    const instance = await startServer({
      port: 0,
      host: "127.0.0.1",
      authFilePath: testAuthFile,
    });

    try {
      // 1. Initial status -> not setup
      const status1 = await getJson(`${instance.url}/api/auth/status`);
      assert.equal(status1.statusCode, 200);
      assert.deepEqual(status1.data, { isSetup: false, isUnlocked: false });

      // 2. Setup password
      const setupRes = await postJson(`${instance.url}/api/auth/setup`, { password: "SecureFinPassword!" });
      assert.equal(setupRes.statusCode, 200);
      assert.equal(setupRes.data.success, true);

      // 3. Status is now setup and unlocked
      const status2 = await getJson(`${instance.url}/api/auth/status`);
      assert.deepEqual(status2.data, { isSetup: true, isUnlocked: true });

      // 4. Lock session
      const lockRes = await postJson(`${instance.url}/api/auth/lock`, {});
      assert.equal(lockRes.statusCode, 200);

      // 5. Trace endpoint must be blocked with 401 when locked
      const traceBlockedRes = await getJson(`${instance.url}/api/trace/binance`);
      assert.equal(traceBlockedRes.statusCode, 401);
      assert.match(traceBlockedRes.data.error, /locked|authenticate/i);

      // 6. Unlock with incorrect password fails
      const unlockFail = await postJson(`${instance.url}/api/auth/unlock`, { password: "BadPassword" });
      assert.equal(unlockFail.statusCode, 401);

      // 7. Unlock with correct password succeeds
      const unlockSuccess = await postJson(`${instance.url}/api/auth/unlock`, { password: "SecureFinPassword!" });
      assert.equal(unlockSuccess.statusCode, 200);
      assert.equal(unlockSuccess.data.success, true);

      // 8. Reset authentication
      const resetRes = await postJson(`${instance.url}/api/auth/reset`, {});
      assert.equal(resetRes.statusCode, 200);
      assert.equal(resetRes.data.success, true);

      const status3 = await getJson(`${instance.url}/api/auth/status`);
      assert.deepEqual(status3.data, { isSetup: false, isUnlocked: false });
    } finally {
      await instance.close();
    }
  });
});
