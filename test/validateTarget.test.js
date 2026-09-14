import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateTarget, validateTargetAsync, isRestrictedIp, MAX_HOST_LENGTH } from "../backend/server.js";

describe("Target Validation & Security Guard", () => {
  test("allows legitimate public IPv4 targets", () => {
    const validIps = ["8.8.8.8", "1.1.1.1", "104.26.10.230", "13.232.0.1", "54.239.28.85"];
    for (const ip of validIps) {
      const res = validateTarget(ip);
      assert.equal(res.valid, true, `Expected valid for public IP: ${ip}`);
      assert.equal(res.host, ip);
    }
  });

  test("allows legitimate public FQDNs", () => {
    const validFqdns = [
      "api.binance.com",
      "www.nseindia.com",
      "www.bseindia.com",
      "www.nyse.com",
      "www.nasdaq.com",
      "ec2.ap-south-1.amazonaws.com",
      "www.bloomberg.com",
      "www.reuters.com",
      "one.one.one.one",
    ];
    for (const fqdn of validFqdns) {
      const res = validateTarget(fqdn);
      assert.equal(res.valid, true, `Expected valid for public FQDN: ${fqdn}`);
      assert.equal(res.host, fqdn);
    }
  });

  test("rejects private RFC-1918 IPv4 ranges", () => {
    const privateIps = [
      "10.0.0.1",
      "10.254.1.10",
      "172.16.0.1",
      "172.20.10.5",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.1.254",
    ];
    for (const ip of privateIps) {
      const res = validateTarget(ip);
      assert.equal(res.valid, false, `Expected invalid for private IP: ${ip}`);
      assert.match(res.error, /private|rfc-1918/i);
    }
  });

  test("rejects loopback, current network, link-local, CGNAT, and multicast/broadcast", () => {
    const forbiddenIps = [
      { ip: "127.0.0.1", reason: /loopback/i },
      { ip: "127.255.255.255", reason: /loopback/i },
      { ip: "0.0.0.0", reason: /loopback|broadcast/i },
      { ip: "169.254.1.1", reason: /link-local/i },
      { ip: "100.64.0.1", reason: /carrier-grade nat/i },
      { ip: "100.127.255.255", reason: /carrier-grade nat/i },
      { ip: "224.0.0.1", reason: /multicast/i },
      { ip: "239.255.255.250", reason: /multicast/i },
      { ip: "255.255.255.255", reason: /multicast|reserved/i },
    ];

    for (const { ip, reason } of forbiddenIps) {
      const res = validateTarget(ip);
      assert.equal(res.valid, false, `Expected rejected for IP: ${ip}`);
    }
  });

  test("rejects IPv6 addresses according to traceroute parser policy", () => {
    const ipv6Targets = ["::1", "fe80::1", "2001:db8::1", "2606:4700:4700::1111"];
    for (const ip of ipv6Targets) {
      const res = validateTarget(ip);
      assert.equal(res.valid, false, `Expected rejected for IPv6: ${ip}`);
      assert.match(res.error, /ipv6/i);
    }
  });

  test("rejects internal/reserved top-level domains, oversized hosts, and localhost", () => {
    const invalidHosts = [
      "localhost",
      "router.local",
      "server.internal",
      "hidden.onion",
      "gateway.lan",
      "mydevice.home",
      "intra.corp",
      "test.example",
      "barehostname",
      "a".repeat(MAX_HOST_LENGTH + 1) + ".com",
      "",
      null,
      undefined,
      "host with spaces.com",
      "../../etc/passwd",
    ];

    for (const host of invalidHosts) {
      const res = validateTarget(host);
      assert.equal(res.valid, false, `Expected invalid for host: ${host}`);
    }
  });

  test("validateTargetAsync resolves DNS and prevents DNS rebinding to private/loopback IPs", async () => {
    // 1. Mock DNS resolving to loopback (e.g. localtest.me -> 127.0.0.1)
    const mockDnsLoopback = async () => ({ address: "127.0.0.1", family: 4 });
    const resLoopback = await validateTargetAsync("localtest.me", { dnsLookupFn: mockDnsLoopback });
    assert.equal(resLoopback.valid, false);
    assert.match(resLoopback.error, /restricted private or loopback/i);

    // 2. Mock DNS resolving to private RFC-1918 (e.g. spoofed.com -> 192.168.1.1)
    const mockDnsPrivate = async () => ({ address: "192.168.1.1", family: 4 });
    const resPrivate = await validateTargetAsync("internal-spoof.com", { dnsLookupFn: mockDnsPrivate });
    assert.equal(resPrivate.valid, false);
    assert.match(resPrivate.error, /restricted private or loopback/i);

    // 3. Mock DNS resolving to legitimate public IP (e.g. api.binance.com -> 13.224.10.1)
    const mockDnsPublic = async () => ({ address: "13.224.10.1", family: 4 });
    const resPublic = await validateTargetAsync("api.binance.com", { dnsLookupFn: mockDnsPublic });
    assert.equal(resPublic.valid, true);
    assert.equal(resPublic.host, "api.binance.com");
    assert.equal(resPublic.resolvedIp, "13.224.10.1");

    // 4. Mock unresolvable host (ENOTFOUND)
    const mockDnsNotFound = async () => {
      const err = new Error("getaddrinfo ENOTFOUND invalid-nonexistent-domain.xyz");
      err.code = "ENOTFOUND";
      throw err;
    };
    const resNotFound = await validateTargetAsync("invalid-nonexistent-domain.xyz", { dnsLookupFn: mockDnsNotFound });
    assert.equal(resNotFound.valid, false);
    assert.match(resNotFound.error, /DNS resolution failed|Host not found/i);
  });
});
