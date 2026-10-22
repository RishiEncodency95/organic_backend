/**
 * Infrastructure module: HTTP-level tests against the real Express app and a real MongoDB.
 *
 * Needs an isolated MongoDB (default mongodb://127.0.0.1:27018/organic_infra_test, override with INFRA_TEST_MONGODB_URI).
 * The suite refuses to run against anything but a localhost database and drops it first. Registry / DNS / TLS lookups
 * and the provider (Contabo) HTTP API are faked: nothing here touches the network or a live provider.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_URI = process.env.INFRA_TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27018/organic_infra_test";
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(TEST_URI)) throw new Error("Refusing to run: the infrastructure tests only run against a localhost MongoDB.");

Object.assign(process.env, {
  NODE_ENV: "test", MONGODB_URI: TEST_URI, ACCESS_TOKEN_SECRET: "test-access-secret", REFRESH_TOKEN_SECRET: "test-refresh-secret", COOKIE_SECRET: "test-cookie-secret",
  INFRASTRUCTURE_ENABLED: "true", ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"), REDIS_URL: "redis://127.0.0.1:1",
  // Never talk to real services from tests
  SMTP_USER: "", SMTP_PASS: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", INFRA_SCHEDULER: "off", INFRA_INGEST_RATE_PER_MIN: "5000", INFRA_REFRESH_BACKOFF_MS: "10",
});

// The app loads backend/.env with dotenv (config/cloudinary.ts even uses override:true), which would replace the test
// settings above with the developer's real SMTP / AI keys. Neutralise dotenv so the suite is hermetic.
vi.mock("dotenv", () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
// No AI call is ever made from tests.
vi.mock("../../src/modules/infrastructure/core/ai-provider", async () => ({ ...(await vi.importActual<any>("../../src/modules/infrastructure/core/ai-provider")), providerKey: () => null }));

let dnsRecords: any = { A: ["203.0.113.7"], AAAA: [], MX: [{ priority: 10, exchange: "mail.example.test" }], NS: ["ns1.example.test"], CNAME: [], TXT: ["v=spf1 -all"], CAA: [], SOA: null, DMARC: ["v=DMARC1; p=reject"] };
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

vi.mock("../../src/modules/infrastructure/core/rdap", async () => ({
  ...(await vi.importActual<any>("../../src/modules/infrastructure/core/rdap")),
  lookupDomain: async () => ({
    state: "OK", source: "https://rdap.test/", error: null,
    parsed: { registrar: "Test Registrar", registeredAt: new Date("2020-01-01"), registryExpiresAt: new Date(Date.now() + 40 * 86_400_000), registrarExpiresAt: null, lastChangedAt: new Date(), statuses: ["client transfer prohibited"], nameservers: ["ns1.example.test"], dnssec: true },
  }),
}));
vi.mock("../../src/modules/infrastructure/core/dns-intel", async () => ({
  ...(await vi.importActual<any>("../../src/modules/infrastructure/core/dns-intel")),
  lookupDns: async () => ({ records: JSON.parse(JSON.stringify(dnsRecords)), errors: {} }),
}));
vi.mock("../../src/modules/infrastructure/core/ssl-intel", async () => ({
  ...(await vi.importActual<any>("../../src/modules/infrastructure/core/ssl-intel")),
  probeCertificate: async () => ({
    ok: true, trusted: true, verifyError: null, error: null,
    certificate: { commonName: "example.test", sans: ["example.test"], issuer: "Test CA", validFrom: new Date(Date.now() - 30 * 86_400_000), validTo: new Date(Date.now() + 90 * 86_400_000), fingerprint: "AA:BB" },
  }),
}));

const CONTABO_SECRET = "s3cr3t-api-password-DO-NOT-LEAK";
let contaboAuthOk = true;
const contaboInstances = [
  { instanceId: 201, name: "vmi201", displayName: "api-server", status: "running", ipConfig: { v4: { ip: "203.0.113.20" }, v6: { ip: "2001:db8::20" } }, cpuCores: 4, ramMb: 8192, diskMb: 204800, regionName: "EU", dataCenter: "European Union 3", osType: "Linux", productId: "V45", productType: "ssd", createdDate: "2025-01-02T03:04:05Z" },
  { instanceId: 202, name: "vmi202", displayName: "db-server", status: "stopped", ipConfig: { v4: { ip: "203.0.113.21" } }, cpuCores: 2, ramMb: 4096, diskMb: 102400, regionName: "EU", dataCenter: "European Union 3", osType: "Linux", productId: "V45", productType: "ssd" },
];
const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (url: any, init?: any) => {
  const u = String(url);
  if (u.includes("auth.contabo.com")) {
    return contaboAuthOk ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }) : new Response("{}", { status: 401 });
  }
  if (u.includes("api.contabo.com/v1/compute/instances/audits")) return new Response(JSON.stringify({ data: [{ id: "a1", action: "start", timestamp: "2026-01-01T00:00:00Z", username: "u@x.test", changes: { new: { status: "running" } } }] }), { status: 200 });
  if (u.includes("/snapshots")) return new Response(JSON.stringify({ data: [{ snapshotId: "s1", name: "nightly", createdDate: "2026-01-01T00:00:00Z" }] }), { status: 200 });
  if (u.includes("api.contabo.com/v1/compute/instances")) return new Response(JSON.stringify({ data: contaboInstances, _pagination: { totalPages: 1 } }), { status: 200 });
  return realFetch(url, init);
});

let server: Server;
let base = "";
let M: typeof import("../../src/models/infrastructure/infrastructure.models");
let sched: typeof import("../../src/modules/infrastructure/infra.scheduler");
const tokens: Record<string, string> = {};

async function api(method: string, path: string, who: string | null, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const res = await realFetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${tokens[who] ?? who}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON (csv / pdf) */ }
  return { status: res.status, json, data: json?.data, text, res };
}

beforeAll(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  const { Admin } = await import("../../src/models/Admin.model");
  const { Role } = await import("../../src/models/Role.model");
  M = await import("../../src/models/infrastructure/infrastructure.models");
  sched = await import("../../src/modules/infrastructure/infra.scheduler");
  await Promise.all(M.INFRA_MODELS.map((m) => m.createIndexes()));
  const mk = async (key: string, name: string, role: "superadmin" | "admin", perms?: string[]) => {
    const r = perms ? await Role.create({ name: `Role ${name}`, slug: `R_${key.toUpperCase()}`, permissionIds: perms }) : null;
    const a = await Admin.create({ name, email: `${key}@example.test`, password: "Passw0rd!123", role, roleId: r ? String(r._id) : undefined, roleName: r ? r.name : undefined });
    tokens[key] = jwt.sign({ id: String(a._id), role }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: "1h" });
  };
  await mk("super", "Super", "superadmin");
  await mk("viewer", "Viewer", "admin", ["perm_infra_view"]);
  await mk("nobody", "Nobody", "admin", ["perm_content_view"]);
  await mk("manager", "Manager", "admin", ["perm_infra_view", "perm_infra_manage"]);
  await mk("biller", "Biller", "admin", ["perm_infra_view", "perm_infra_billing_view", "perm_infra_billing_manage"]);
  const { default: app } = await import("../../src/app");
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/infrastructure`;
});

afterAll(async () => {
  await new Promise((r) => server?.close(r));
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
});

const S: Record<string, any> = {};

describe("authentication and permissions", () => {
  it("rejects requests without a token", async () => {
    for (const p of ["/dashboard", "/servers", "/domains", "/providers", "/alerts", "/reports", "/billing/payments", "/settings"]) {
      expect((await api("GET", p, null)).status, p).toBe(401);
    }
    expect((await api("POST", "/servers", null, { name: "x" })).status).toBe(401);
  });
  it("rejects a garbage / forged token", async () => {
    expect((await api("GET", "/dashboard", "not.a.jwt")).status).toBe(401);
    const forged = jwt.sign({ id: "64b000000000000000000000", role: "superadmin" }, "wrong-secret");
    expect((await api("GET", "/dashboard", forged)).status).toBe(401);
  });
  it("rejects a signed token for an account that does not exist", async () => {
    const ghost = jwt.sign({ id: "64b000000000000000000001", role: "superadmin" }, process.env.ACCESS_TOKEN_SECRET!);
    expect((await api("GET", "/dashboard", ghost)).status).toBe(403);
  });
  it("gives users without infrastructure permissions no access", async () => {
    expect((await api("GET", "/dashboard", "nobody")).status).toBe(403);
    expect((await api("GET", "/servers", "nobody")).status).toBe(403);
  });
  it("view-only users can read but not change anything", async () => {
    expect((await api("GET", "/servers", "viewer")).status).toBe(200);
    expect((await api("POST", "/servers", "viewer", { name: "nope" })).status).toBe(403);
    expect((await api("POST", "/domains", "viewer", { domain: "nope.test" })).status).toBe(403);
    expect((await api("POST", "/subscriptions", "viewer", {})).status).toBe(403);
    expect((await api("GET", "/providers", "viewer")).status).toBe(403);
    expect((await api("PUT", "/settings", "viewer", { emailEnabled: false })).status).toBe(403);
    expect((await api("GET", "/billing/payments", "viewer")).status).toBe(403);
  });
  it("manage permission is not enough for integrations or billing writes", async () => {
    expect((await api("POST", "/providers/connections", "manager", { provider: "contabo", label: "x" })).status).toBe(403);
    expect((await api("POST", "/subscriptions", "manager", {})).status).toBe(403);
    expect((await api("PUT", "/monitoring/thresholds", "manager", { cpuPct: 80 })).status).toBe(403);
  });
  it("reports capabilities for the caller", async () => {
    const r = await api("GET", "/capabilities", "viewer");
    expect(r.status).toBe(200);
    expect(r.data.billingRead).toBe(false);
    expect(r.data.permissions.manage).toBe(false);
    const s = await api("GET", "/capabilities", "super");
    expect(s.data.billingRead).toBe(true);
    expect(s.data.encryptionConfigured).toBe(true);
    expect(s.data.providers.find((p: any) => p.key === "contabo").live).toBe(true);
  });
});

describe("servers", () => {
  it("validates input", async () => {
    expect((await api("POST", "/servers", "super", {})).status).toBe(400);
    const bad = await api("POST", "/servers", "super", { name: "x", ipv4: "999.1.1.1" });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("infra_invalid_ipv4");
    expect((await api("POST", "/servers", "super", { name: "x", vcpu: -1 })).status).toBe(400);
    expect((await api("POST", "/servers", "super", { name: "x", environment: "MOON" })).status).toBe(400);
  });
  it("creates, reads, lists, searches and updates a manual server", async () => {
    const c = await api("POST", "/servers", "manager", { name: "web-1", hostname: "web1.example.test", ipv4: "198.51.100.5", provider: "hostinger", region: "IN", vcpu: 2, ramMb: 4096, storageGb: 80, tags: ["Web", "web", " prod "], environment: "PRODUCTION" });
    expect(c.status).toBe(201);
    S.web = c.data.id;
    expect(c.data.tags).toEqual(["web", "prod"]);
    expect(c.data.source).toBe("manual");
    expect(c.data.server.ipv4).toBe("198.51.100.5");
    const g = await api("GET", `/assets/${S.web}`, "viewer");
    expect(g.status).toBe(200);
    expect(g.data.name).toBe("web-1");
    const l = await api("GET", "/servers?q=web1", "viewer");
    expect(l.data.total).toBe(1);
    expect((await api("GET", "/servers?q=198.51", "viewer")).data.total).toBe(1);
    expect((await api("GET", "/servers?q=zzz-none", "viewer")).data.total).toBe(0);
    const u = await api("PATCH", `/assets/${S.web}`, "manager", { name: "web-one", vcpu: 4, notes: "n" });
    expect(u.status).toBe(200);
    expect(u.data.name).toBe("web-one");
    expect(u.data.server.vcpu).toBe(4);
  });
  it("rejects malformed ids and unknown assets", async () => {
    expect((await api("GET", "/assets/not-an-id", "super")).status).toBe(400);
    expect((await api("GET", "/assets/64b0000000000000000000aa", "super")).status).toBe(404);
  });
  it("is not vulnerable to operator injection through query strings", async () => {
    const r = await api("GET", "/servers?q[$ne]=zzz&sort[$gt]=1&page[$gt]=0", "super");
    expect(r.status).toBe(200);
    expect(r.data.total).toBeGreaterThanOrEqual(1);
  });
  it("archives, restores, and only deletes archived assets", async () => {
    const x = (await api("POST", "/servers", "manager", { name: "temp" })).data.id;
    expect((await api("DELETE", `/assets/${x}`, "manager")).json.code).toBe("infra_archive_first");
    expect((await api("POST", `/assets/${x}/archive`, "manager")).status).toBe(200);
    expect((await api("GET", "/servers", "viewer")).data.items.some((i: any) => i.id === x)).toBe(false);
    expect((await api("GET", "/servers?archived=true", "viewer")).data.items.some((i: any) => i.id === x)).toBe(true);
    expect((await api("POST", `/assets/${x}/restore`, "manager")).status).toBe(200);
    expect((await api("POST", `/assets/${x}/archive`, "manager")).status).toBe(200);
    expect((await api("DELETE", `/assets/${x}`, "manager")).status).toBe(200);
    expect((await api("GET", `/assets/${x}`, "manager")).status).toBe(404);
  });
  it("links assets, refuses self and duplicate links", async () => {
    const d = (await api("POST", "/domains", "manager", { domain: "linked.example-infra.org" })).data.id;
    S.linkedDomain = d;
    expect((await api("POST", `/assets/${d}/links`, "manager", { toAssetId: d, kind: "USES" })).json.code).toBe("infra_self_link");
    const l = await api("POST", `/assets/${d}/links`, "manager", { toAssetId: S.web, kind: "POINTS_TO" });
    expect(l.status).toBe(201);
    expect((await api("POST", `/assets/${d}/links`, "manager", { toAssetId: S.web, kind: "POINTS_TO" })).json.code).toBe("infra_already_linked");
    const detail = await api("GET", `/assets/${S.web}`, "viewer");
    expect(detail.data.relations).toHaveLength(1);
    expect(detail.data.relations[0].direction).toBe("in");
    expect((await api("DELETE", `/assets/${d}/links/${l.data.id}`, "manager")).status).toBe(200);
  });
});

describe("domains, DNS, RDAP and SSL", () => {
  it("normalises, rejects invalid names and prevents duplicates", async () => {
    expect((await api("POST", "/domains", "manager", { domain: "https://User:pw@bad.test/x" })).status).toBe(400);
    expect((await api("POST", "/domains", "manager", { domain: "192.168.0.1" })).json.code).toBe("infra_invalid_domain");
    expect((await api("POST", "/domains", "manager", { domain: "foo.localhost" })).status).toBe(400);
    const c = await api("POST", "/domains", "manager", { domain: "example-infra.org/path?x=1" });
    expect(c.status).toBe(400); // a bare path is refused (a full URL is reduced to its host)
    const ok = await api("POST", "/domains", "manager", { domain: "https://Example-Infra.ORG" });
    expect(ok.status).toBe(201);
    S.domain = ok.data.id;
    expect(ok.data.domain.fqdn).toBe("example-infra.org");
    const dup = await api("POST", "/domains", "manager", { domain: "example-infra.org" });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("infra_domain_exists");
    expect(dup.json.assetId).toBe(S.domain);
  });
  it("fills registry, DNS and SSL data in the background", async () => {
    let d: any;
    for (let i = 0; i < 40; i++) {
      d = (await api("GET", `/assets/${S.domain}`, "viewer")).data;
      if (d.domain.rdapState === "OK" && d.domain.dnsState === "OK" && d.certificates.some((c: any) => c.lastCheckedAt)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(d.domain.rdapState).toBe("OK");
    expect(d.domain.registrar).toBe("Test Registrar");
    expect(d.domain.effectiveExpiry.source).toBe("rdap");
    expect(d.domain.effectiveExpiry.verified).toBe(true);
    expect(d.dnsPosture.spf.present).toBe(true);
    expect(d.dnsPosture.dmarc.policy).toBe("reject");
    expect(d.certificates[0].state).toBe("VALID");
    expect(d.certificates[0].issuer).toBe("Test CA");
    expect(d.certificates[0].trusted).toBe(true);
  });
  it("hides TXT contents from callers without integration rights", async () => {
    const a = await api("GET", `/assets/${S.domain}`, "viewer");
    expect(JSON.stringify(a.data.dnsHistory[0].records.TXT)).toContain("hidden");
    expect(a.data.dnsHistory[0].records.txtRedacted).toBe(true);
    const b = await api("GET", `/assets/${S.domain}`, "super");
    expect(b.data.dnsHistory[0].records.TXT).toEqual(["v=spf1 -all"]);
  });
  it("detects DNS changes, stores a snapshot diff and raises one alert", async () => {
    dnsRecords = { ...dnsRecords, A: ["203.0.113.99"], TXT: ["v=spf1 -all", "google-site-verification=SECRETTOKEN"] };
    const r = await api("POST", `/assets/${S.domain}/refresh`, "manager");
    expect(r.status).toBe(200);
    expect(r.data.dns.changed).toBe(true);
    const detail = (await api("GET", `/assets/${S.domain}`, "super")).data;
    expect(detail.dnsHistory[0].changed).toBe(true);
    expect(detail.dnsHistory[0].changes.map((c: any) => c.type).sort()).toEqual(["A", "TXT"]);
    const alerts = (await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data;
    expect(alerts.total).toBe(1);
    expect(alerts.items[0].message).not.toContain("SECRETTOKEN"); // alert text carries types and counts only
    await api("POST", `/assets/${S.domain}/refresh`, "manager"); // unchanged -> no second alert
    expect((await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data.total).toBe(1);
  });
  it("only monitors certificates for hostnames inside the inventory", async () => {
    expect((await api("POST", "/certificates", "manager", { assetId: S.domain, hostname: "evil.com" })).json.code).toBe("infra_host_outside_domain");
    expect((await api("POST", "/certificates", "manager", { assetId: S.domain, hostname: "127.0.0.1" })).status).toBe(400);
    expect((await api("POST", "/certificates", "manager", { assetId: S.domain, hostname: "example-infra.org", port: 22 })).status).toBe(400);
    const ok = await api("POST", "/certificates", "manager", { assetId: S.domain, hostname: "www.example-infra.org" });
    expect(ok.status).toBe(201);
    const list = (await api("GET", "/certificates", "viewer")).data;
    expect(list.map((c: any) => c.hostname)).toEqual(expect.arrayContaining(["example-infra.org", "www.example-infra.org"]));
    expect((await api("POST", `/certificates/${ok.data.id}/refresh`, "manager")).status).toBe(200);
  });
  it("imports domains in bulk with per-line results", async () => {
    const r = await api("POST", "/domains/bulk", "manager", { domains: ["alpha.example-infra.org", "beta.example-infra.org", "alpha.example-infra.org", "bad domain", "example-infra.org"] });
    expect(r.status).toBe(200);
    expect(r.data.created).toBe(2);
    expect(r.data.results.map((x: any) => x.status)).toEqual(["created", "created", "duplicate", "invalid", "duplicate"]);
    S.bulk = r.data.results.filter((x: any) => x.assetId).map((x: any) => x.assetId);
  });
  it("queues a de-duplicated background refresh", async () => {
    const a = await api("POST", "/domains/refresh", "manager", { assetIds: S.bulk });
    expect(a.status).toBe(202);
    expect(a.data.queued).toBe(2);
    const b = await api("POST", "/domains/refresh", "manager", { assetIds: S.bulk });
    expect(b.data.deduplicated).toBe(true);
    expect((await api("POST", "/domains/refresh", "manager", { assetIds: ["zz"] })).status).toBe(400);
  });
  it("serves domain analytics", async () => {
    const a = (await api("GET", "/domains/analytics", "viewer")).data;
    expect(a.totals.domains).toBeGreaterThanOrEqual(3);
    expect(a.expiryWindows.reduce((n: number, w: any) => n + w.value, 0)).toBe(a.totals.withKnownExpiry);
    expect(a.registrars[0].label).toBe("Test Registrar");
    expect(a.checkHistory).toHaveLength(14);
  });
});

describe("billing, renewals and projections", () => {
  it("creates a subscription with manually verified dates", async () => {
    expect((await api("POST", "/subscriptions", "biller", {})).json.code).toBe("infra_asset_required");
    expect((await api("POST", "/subscriptions", "biller", { assetId: S.web, cycle: "CUSTOM" })).json.code).toBe("infra_custom_interval_required");
    expect((await api("POST", "/subscriptions", "biller", { assetId: S.web, amount: 10.123 })).status).toBe(400);
    const due = inDays(5).toISOString().slice(0, 10);
    const c = await api("POST", "/subscriptions", "biller", { assetId: S.web, cycle: "MONTHLY", amount: 1500.5, currency: "INR", nextDueDate: due, label: "VPS plan" });
    expect(c.status).toBe(201);
    S.sub = c.data.id;
    S.due = due;
    const subs = (await api("GET", "/subscriptions", "biller")).data;
    const s = subs.find((x: any) => x.id === S.sub);
    expect(s.amount).toBe(1500.5);
    expect(s.currency).toBe("INR");
    expect(s.dateSources.nextDueDate.source).toBe("manual");
  });
  it("hides amounts from callers without billing view", async () => {
    const s = (await api("GET", "/subscriptions", "viewer")).data.find((x: any) => x.id === S.sub);
    expect(s.billingHidden).toBe(true);
    expect(s.amount).toBeUndefined();
    const a = (await api("GET", `/assets/${S.web}`, "viewer")).data;
    expect(a.subscriptions[0].amount).toBeNull();
    expect((await api("GET", "/dashboard", "viewer")).data.billing).toBeUndefined();
    expect((await api("GET", "/dashboard", "biller")).data.billing.monthlyEquivalent).toEqual([{ currency: "INR", amount: 1500.5 }]);
  });
  it("raises a renewal alert once and never from projections", async () => {
    const alerts = (await api("GET", "/alerts?kind=RENEWAL_DUE", "viewer")).data;
    expect(alerts.total).toBe(1);
    expect(alerts.items[0].thresholdDays).toBe(7);
    expect(alerts.items[0].delivery.attempts).toBe(1);
    expect(alerts.items[0].delivery.summary.inApp).toBeGreaterThanOrEqual(1);
    expect(alerts.items[0].delivery.summary.email.skipped).toBeTruthy();
    const { evaluateAlerts } = await import("../../src/modules/infrastructure/infra.alerts");
    await Promise.all([evaluateAlerts(), evaluateAlerts(), evaluateAlerts()]);
    expect((await api("GET", "/alerts?kind=RENEWAL_DUE", "viewer")).data.total).toBe(1);
  });
  it("lists renewals with sources and verification", async () => {
    const r = (await api("GET", "/renewals?window=30", "biller")).data;
    const due = r.items.find((i: any) => i.subscriptionId === S.sub);
    expect(due.kind).toBe("payment_due");
    expect(due.verified).toBe(true);
    expect(due.amount).toBe(1500.5);
    expect(r.items.some((i: any) => i.kind === "domain_expiry")).toBe(false); // 40 days away
    const hidden = (await api("GET", "/renewals?window=30", "viewer")).data.items.find((i: any) => i.subscriptionId === S.sub);
    expect(hidden.amount).toBeNull();
  });
  it("confirms a payment once, advances the due date and keeps history", async () => {
    const paid = new Date().toISOString().slice(0, 10);
    const future = await api("POST", `/subscriptions/${S.sub}/payments`, "biller", { coversDueDate: S.due, paidAt: inDays(3).toISOString().slice(0, 10), amount: 1500.5 });
    expect(future.json.code).toBe("infra_future_payment");
    const [a, b] = await Promise.all([
      api("POST", `/subscriptions/${S.sub}/payments`, "biller", { coversDueDate: S.due, paidAt: paid, amount: 1500.5, invoiceRef: "INV-1" }),
      api("POST", `/subscriptions/${S.sub}/payments`, "biller", { coversDueDate: S.due, paidAt: paid, amount: 1500.5, invoiceRef: "INV-1" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const ok = a.status === 201 ? a : b;
    expect(ok.data.advanced).toBe(true);
    expect(ok.data.nextDueDate > S.due).toBe(true);
    expect((await api("POST", `/subscriptions/${S.sub}/payments`, "biller", { coversDueDate: S.due, paidAt: paid, amount: 1500.5 })).json.code).toBe("infra_payment_exists");
    const hist = (await api("GET", `/subscriptions/${S.sub}/history`, "biller")).data;
    expect(hist).toHaveLength(1);
    expect(hist[0].amount).toBe(1500.5);
    expect((await api("GET", `/subscriptions/${S.sub}/history`, "viewer")).status).toBe(403);
    const sub = (await api("GET", "/subscriptions", "biller")).data.find((x: any) => x.id === S.sub);
    expect(sub.nextDueDate).toBe(ok.data.nextDueDate);
    expect(sub.dateSources.nextDueDate.source).toBe("cycle_from_confirmed_payment");
    const pay = (await api("GET", "/billing/payments", "biller")).data;
    expect(pay[0].totals).toEqual([{ currency: "INR", amount: 1500.5 }]);
  });
  it("closes the alert once the due date moved", async () => {
    const { evaluateAlerts } = await import("../../src/modules/infrastructure/infra.alerts");
    await evaluateAlerts();
    expect((await api("GET", "/alerts?kind=RENEWAL_DUE&state=active", "viewer")).data.total).toBe(0);
    expect((await api("GET", "/alerts?kind=RENEWAL_DUE&state=RESOLVED", "viewer")).data.total).toBe(1);
  });
  it("records adjustments and validates them", async () => {
    expect((await api("POST", `/subscriptions/${S.sub}/adjustments`, "biller", { amount: -100, date: "2026-01-01", note: "x" })).status).toBe(400);
    const a = await api("POST", `/subscriptions/${S.sub}/adjustments`, "biller", { amount: -100.25, date: "2026-01-01", note: "credit note" });
    expect(a.status).toBe(201);
    const hist = (await api("GET", `/subscriptions/${S.sub}/history`, "biller")).data;
    expect(hist.find((h: any) => h.kind === "ADJUSTMENT").amount).toBe(-100.25);
  });
  it("keeps currencies separate and projects only from confirmed dates", async () => {
    const usd = await api("POST", "/subscriptions", "biller", { assetId: S.domain, kind: "DOMAIN_REGISTRATION", cycle: "YEARLY", amount: 12, currency: "USD", nextDueDate: inDays(60).toISOString().slice(0, 10) });
    expect(usd.status).toBe(201);
    await api("POST", "/subscriptions", "biller", { assetId: S.domain, cycle: "MONTHLY", label: "no amount" });
    const d = (await api("GET", "/dashboard", "biller")).data;
    const cur = d.billing.monthlyEquivalent.map((m: any) => m.currency).sort();
    expect(cur).toEqual(["INR", "USD"]);
    expect(d.billing.monthlyEquivalent.find((m: any) => m.currency === "USD").amount).toBe(1);
    expect(d.billing.excluded.unknownAmount).toBe(1);
    expect(d.billing.monthlyProjection).toHaveLength(12);
  });
  it("manual domain expiry overrides the registry date", async () => {
    const sub = (await api("GET", "/subscriptions", "biller")).data.find((x: any) => x.kind === "DOMAIN_REGISTRATION");
    await api("PATCH", `/subscriptions/${sub.id}`, "biller", { expirationDate: inDays(200).toISOString().slice(0, 10) });
    const d = (await api("GET", `/assets/${S.domain}`, "viewer")).data;
    expect(d.domain.effectiveExpiry.source).toBe("manual");
  });
  it("exports CSV with formula-injection protection and respects billing visibility", async () => {
    await api("POST", "/servers", "manager", { name: "=HYPERLINK(\"http://evil\")" });
    const csv = await api("GET", "/export/servers", "viewer");
    expect(csv.status).toBe(200);
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(csv.text).toContain("'=HYPERLINK");
    expect((await api("GET", "/export/renewals", "viewer")).text).not.toContain("Amount");
    expect((await api("GET", "/export/renewals", "biller")).text).toContain("Amount");
    expect((await api("GET", "/export/domains", "viewer")).text).toContain("example-infra.org");
    expect((await api("GET", "/export/secrets", "viewer")).status).toBe(404);
  });
});

describe("alert lifecycle and settings", () => {
  it("acknowledges, snoozes, resolves and reopens", async () => {
    const a = (await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data.items[0];
    expect((await api("POST", `/alerts/${a.id}/action`, "viewer", { action: "acknowledge" })).status).toBe(403);
    expect((await api("POST", `/alerts/${a.id}/action`, "manager", { action: "bogus" })).status).toBe(400);
    expect((await api("POST", `/alerts/${a.id}/action`, "manager", { action: "acknowledge" })).data.state).toBe("ACKNOWLEDGED");
    expect((await api("POST", `/alerts/${a.id}/action`, "manager", { action: "snooze", snoozeDays: 2 })).data.state).toBe("SNOOZED");
    const snoozed = (await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data.items[0];
    expect(snoozed.snoozedUntil).toBeTruthy();
    expect((await api("POST", `/alerts/${a.id}/action`, "manager", { action: "resolve" })).data.state).toBe("RESOLVED");
    expect((await api("POST", `/alerts/${a.id}/action`, "manager", { action: "reopen" })).data.state).toBe("OPEN");
    expect((await api("POST", "/alerts/64b0000000000000000000aa/action", "manager", { action: "resolve" })).status).toBe(404);
  });
  it("reopens an expired snooze without a new notification", async () => {
    const a = (await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data.items[0];
    await api("POST", `/alerts/${a.id}/action`, "manager", { action: "snooze", snoozeDays: 1 });
    await M.InfraAlert.updateOne({ _id: a.id }, { $set: { snoozedUntil: new Date(Date.now() - 1000) } });
    const { evaluateAlerts } = await import("../../src/modules/infrastructure/infra.alerts");
    await evaluateAlerts();
    expect((await api("GET", "/alerts?kind=DNS_CHANGE", "viewer")).data.items[0].state).toBe("OPEN");
  });
  it("validates and saves reminder settings", async () => {
    expect((await api("PUT", "/settings", "super", { thresholdDays: [400] })).status).toBe(400);
    expect((await api("PUT", "/settings", "super", { extraRecipients: ["not-an-email"] })).status).toBe(400);
    const s = await api("PUT", "/settings", "super", { thresholdDays: [7, 30, 7, 1], extraRecipients: ["Ops@Example.test"], emailEnabled: false });
    expect(s.data.thresholdDays).toEqual([30, 7, 1]);
    expect(s.data.extraRecipients).toEqual(["ops@example.test"]);
    expect(s.data.emailEnabled).toBe(false);
    expect((await api("GET", "/settings", "viewer")).data.emailTransportConfigured).toBe(false);
    await api("PUT", "/settings", "super", { thresholdDays: [30, 15, 7, 3, 1, 0], emailEnabled: true, extraRecipients: [] });
  });
  it("exposes in-app notifications to administrators", async () => {
    const n = await api("GET", "/notifications", "super");
    expect(n.status).toBe(200);
    expect(n.data.items.length).toBeGreaterThan(0);
    expect(n.data.unread).toBe(n.data.items.length);
    const r = await api("POST", "/notifications/read", "super", {});
    expect(r.data.updated).toBeGreaterThan(0);
    expect((await api("GET", "/notifications", "super")).data.unread).toBe(0);
    expect((await api("GET", "/notifications", "manager")).data.items).toHaveLength(0); // not an alert recipient
  });
});

describe("providers and credential security", () => {
  const creds = { clientId: "client-id-1234", clientSecret: "client-secret-ABCDEF", apiUser: "api@example.test", apiPassword: CONTABO_SECRET };
  it("refuses manual-only providers and bad credentials", async () => {
    expect((await api("POST", "/providers/connections", "super", { provider: "aws", label: "AWS" })).json.code).toBe("infra_provider_manual_only");
    expect((await api("POST", "/providers/connections", "super", { provider: "contabo", label: "C", credentials: { clientId: "a" } })).json.code).toBe("infra_credentials_invalid");
  });
  it("encrypts credentials, tests the connection and never returns the secret", async () => {
    const c = await api("POST", "/providers/connections", "super", { provider: "contabo", label: "Contabo prod", credentials: creds });
    expect(c.status).toBe(201);
    S.conn = c.data.id;
    expect(c.data.status).toBe("CONNECTED");
    expect(c.data.credentialsSaved).toBe(true);
    expect(c.data.credentialHint).toEqual({ clientId: "…1234", apiUser: "api@example.test" });
    const raw = await M.InfraProviderConnection.findById(S.conn).select("+credentialsSecret").lean<any>();
    expect(raw.credentialsSecret.startsWith("v1:")).toBe(true);
    expect(raw.credentialsSecret).not.toContain(CONTABO_SECRET);
    for (const p of ["/providers", `/providers/connections/${S.conn}/runs`, "/capabilities", "/dashboard"]) {
      const r = await api("GET", p, "super");
      expect(r.text, p).not.toContain(CONTABO_SECRET);
      expect(r.text, p).not.toContain("client-secret-ABCDEF");
      expect(r.text, p).not.toContain("credentialsSecret");
      expect(r.text, p).not.toContain(raw.credentialsSecret);
    }
    // The Activity Log plugin masks secret-looking keys; the ciphertext must not appear there either.
    const { ActivityLog } = await import("../../src/models/ActivityLog.model");
    expect(JSON.stringify(await ActivityLog.find({}).lean())).not.toContain(raw.credentialsSecret);
  });
  it("reports an authentication failure without crashing", async () => {
    contaboAuthOk = false;
    const r = await api("POST", `/providers/connections/${S.conn}/test`, "super");
    expect(r.data.status).toBe("AUTH_FAILED");
    expect(r.data.lastErrorCode).toBe("AUTH_FAILED");
    contaboAuthOk = true;
    expect((await api("POST", `/providers/connections/${S.conn}/test`, "super")).data.status).toBe("CONNECTED");
  });
  it("lists remote instances, imports selected ones and ignores repeats", async () => {
    const inst = await api("GET", `/providers/connections/${S.conn}/instances`, "super");
    expect(inst.data.instances).toHaveLength(2);
    expect(inst.data.instances.every((i: any) => i.imported === false)).toBe(true);
    const imp = await api("POST", `/providers/connections/${S.conn}/import`, "super", { remoteIds: ["201", "999"] });
    expect(imp.data).toMatchObject({ created: 1, skipped: 0, notFound: 1 });
    expect((await api("POST", `/providers/connections/${S.conn}/import`, "super", { remoteIds: ["201"] })).data).toMatchObject({ created: 0, skipped: 1 });
    expect((await api("POST", `/providers/connections/${S.conn}/import`, "super", {})).json.code).toBe("infra_nothing_selected");
    const list = (await api("GET", "/servers?provider=contabo", "viewer")).data;
    expect(list.total).toBe(1);
    expect(list.items[0].server.vcpu).toBe(4);
    expect(list.items[0].server.storageGb).toBe(200);
    expect(list.items[0].server.providerStatus).toBe("running");
    expect(list.items[0].source).toBe("provider_api");
    S.imported = list.items[0].id;
  });
  it("does not let the provider-owned fields be edited manually", async () => {
    const u = await api("PATCH", `/assets/${S.imported}`, "manager", { vcpu: 99, name: "renamed" });
    expect(u.data.server.vcpu).toBe(4);
    expect(u.data.name).toBe("renamed");
  });
  it("syncs: updates, adds new instances and records the run", async () => {
    contaboInstances[0].status = "stopped";
    const s = await api("POST", `/providers/connections/${S.conn}/sync`, "super");
    expect(s.data).toMatchObject({ status: "SUCCEEDED", seen: 2, updated: 1, created: 1 });
    expect((await api("GET", `/assets/${S.imported}`, "viewer")).data.server.providerStatus).toBe("stopped");
    const runs = (await api("GET", `/providers/connections/${S.conn}/runs`, "super")).data;
    expect(runs[0].status).toBe("SUCCEEDED");
    expect((await api("GET", "/servers?provider=contabo", "viewer")).data.total).toBe(2);
  });
  it("marks instances missing from a complete listing as not listed, without changing their status", async () => {
    const removed = contaboInstances.pop()!;
    await api("POST", `/providers/connections/${S.conn}/sync`, "super");
    const all = (await api("GET", "/servers?provider=contabo", "viewer")).data.items;
    const gone = all.find((i: any) => i.remoteId === "202");
    expect(gone.server.syncState).toBe("NOT_LISTED");
    expect(gone.server.providerStatus).toBe("stopped");
    contaboInstances.push(removed);
  });
  it("keeps data untouched when the provider fails", async () => {
    contaboAuthOk = false;
    const r = await api("POST", `/providers/connections/${S.conn}/sync`, "super");
    expect(r.status).toBe(422);
    contaboAuthOk = true;
    expect((await api("GET", `/providers/connections/${S.conn}/runs`, "super")).data[0].status).toBe("FAILED");
    expect((await api("GET", "/servers?provider=contabo", "viewer")).data.total).toBe(2);
    await api("POST", `/providers/connections/${S.conn}/test`, "super");
  });
  it("reads provider snapshots and audit history, and reports manual servers honestly", async () => {
    const x = (await api("GET", `/assets/${S.imported}/provider-details`, "super")).data;
    expect(x.available).toBe(true);
    expect(x.snapshots[0].name).toBe("nightly");
    expect(x.audits[0].changedFields).toEqual(["status"]);
    expect((await api("GET", `/assets/${S.web}/provider-details`, "super")).data.reason).toBe("manual");
    expect((await api("GET", `/assets/${S.imported}/provider-details`, "manager")).status).toBe(403);
  });
  it("replaces credentials and disconnects by destroying the ciphertext", async () => {
    const r = await api("PUT", `/providers/connections/${S.conn}/credentials`, "super", { credentials: { ...creds, apiPassword: "new-pass" } });
    expect(r.data.status).toBe("CONNECTED");
    const d = await api("DELETE", `/providers/connections/${S.conn}`, "super");
    expect(d.status).toBe(200);
    const raw = await M.InfraProviderConnection.findById(S.conn).select("+credentialsSecret").lean<any>();
    expect(raw.credentialsSecret).toBeNull();
    expect(raw.status).toBe("DISCONNECTED");
    expect((await api("POST", `/providers/connections/${S.conn}/sync`, "super")).json.code).toBe("infra_credentials_missing");
    expect((await api("GET", `/assets/${S.imported}`, "viewer")).data.server.syncState).toBe("DISCONNECTED");
  });
  it("refuses to store credentials when no encryption key is configured", async () => {
    const key = process.env.ENCRYPTION_MASTER_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
    const r = await api("POST", "/providers/connections", "super", { provider: "contabo", label: "No key", credentials: creds });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("infra_encryption_not_configured");
    process.env.ENCRYPTION_MASTER_KEY = "AAAA"; // wrong length
    expect((await api("POST", "/providers/connections", "super", { provider: "contabo", label: "Bad key", credentials: creds })).status).toBe(503);
    process.env.ENCRYPTION_MASTER_KEY = key;
    expect(await M.InfraProviderConnection.countDocuments({ label: { $in: ["No key", "Bad key"] } })).toBe(0);
  });
});

describe("server monitoring (collector, ingest, thresholds)", () => {
  const T0 = Date.now() - 9 * 60_000; // samples older than 10 minutes are refused, so history is built inside that window
  const push = (i: number, over: Record<string, unknown> = {}, tsOffset = i * 30_000) => ({
    v: 1, ts: new Date(T0 + tsOffset).toISOString(), agentVersion: "1.0.0",
    host: { hostname: "web1", os: "Ubuntu 24.04", kernel: "6.8", arch: "x86_64", cpuCores: 4 },
    cpu: { user: 1000 + i * 900, nice: 0, system: 200 + i * 40, idle: 8000 + i * 60, iowait: 0, irq: 0, softirq: 0, steal: 0 },
    memory: { totalBytes: 8_000_000_000, availableBytes: 3_000_000_000, cachedBytes: 1_000_000_000, swapTotalBytes: 1_000_000_000, swapFreeBytes: 900_000_000 },
    load: [3.2, 2.5, 2.1], uptimeSec: 86_400 + i * 30,
    filesystems: [{ mount: "/", fstype: "ext4", totalBytes: 100_000_000_000, usedBytes: 40_000_000_000, inodesTotal: 1000, inodesUsed: 100 }],
    disk: { readBytes: i * 1_000_000, writeBytes: i * 2_000_000 }, network: { rxBytes: i * 3_000_000, txBytes: i * 1_000_000, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
    containers: [{ id: "abc123def4567", name: "/web", image: "https://user:pass@registry.example/app:1", state: "running", restartCount: 0 }],
    ...over,
  });
  const ingest = (token: string | null, body: unknown, raw?: string) =>
    realFetch(`${base}/ingest`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: raw ?? JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

  it("requires the integrations permission to manage a collector", async () => {
    expect((await api("POST", `/assets/${S.web}/collector`, "manager", {})).status).toBe(403);
    expect((await api("POST", `/assets/${S.domain}/collector`, "super", {})).status).toBe(404); // only servers
  });
  it("issues a token once and stores only its hash", async () => {
    const c = await api("POST", `/assets/${S.web}/collector`, "super", { label: "web1" });
    expect(c.status).toBe(201);
    S.token = c.data.token;
    expect(S.token.startsWith("omi_col_")).toBe(true);
    expect(c.data.ingestPath).toBe("/api/v1/infrastructure/ingest");
    const row = await M.InfraCollector.findOne({ assetId: S.web }).lean<any>();
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(S.token);
    const st = (await api("GET", `/assets/${S.web}/monitoring`, "super")).data;
    expect(JSON.stringify(st)).not.toContain(S.token);
    expect(st.collector.tokenHint).toBe(S.token.slice(-4));
    expect(st.state).toBe("pending");
  });
  it("rejects missing, malformed, wrong and cross-purpose tokens", async () => {
    expect((await ingest(null, push(0))).status).toBe(401);
    expect((await ingest("omi_col_nope", push(0))).status).toBe(401);
    expect((await ingest("x".repeat(200), push(0))).status).toBe(401);
    expect((await ingest(tokens.super, push(0))).status).toBe(401); // an admin JWT is not a collector token
  });
  it("validates payloads and counts rejections", async () => {
    expect((await ingest(S.token, { v: 2 })).json.code).toBe("infra_invalid_sample");
    expect((await ingest(S.token, push(0, { cpu: { user: 1 } }))).status).toBe(400);
    expect((await ingest(S.token, push(0, { memory: { totalBytes: 10, availableBytes: 99 } }))).status).toBe(400);
    expect((await ingest(S.token, push(0, { ts: new Date(Date.now() + 3_600_000).toISOString() }))).status).toBe(400);
    expect((await ingest(S.token, null, "{not json")).json.code).toBe("infra_invalid_sample");
    expect((await ingest(S.token, push(0, { ts: new Date(Date.now() - 3_600_000).toISOString() }))).status).toBe(400);
    expect((await M.InfraCollector.findOne({ assetId: S.web }).lean<any>()).rejectedCount).toBeGreaterThanOrEqual(4);
  });
  it("enforces the body size cap before parsing", async () => {
    const big = { ...push(0), junk: "x".repeat(300_000) };
    const r = await ingest(S.token, big);
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("infra_payload_too_large");
  });
  it("accepts samples, derives rates from counter deltas and scrubs registry credentials", async () => {
    const first = await ingest(S.token, push(0));
    expect(first.status).toBe(202);
    expect(first.json.data.accepted).toBe(true);
    expect((await ingest(S.token, push(0))).status).toBe(429); // same timestamp: too frequent / duplicate
    expect((await ingest(S.token, push(0, {}, 5_000))).json.code).toBe("infra_too_frequent");
    expect((await ingest(S.token, push(1))).status).toBe(202);
    const sample = await M.InfraMetricSample.findOne({ assetId: S.web }).sort({ ts: -1 }).lean<any>();
    // user +900, system +40, idle +60 (jiffies) => (940 / 1000) = 94%
    expect(sample.cpuPct).toBeCloseTo(94, 0);
    expect(sample.memTotalBytes).toBe(8_000_000_000);
    expect(sample.diskMaxUsedPct).toBeCloseTo(40, 1);
    expect(sample.netRxBps).toBeCloseTo(100_000, -3); // 3 MB over 30 s
    const col = await M.InfraCollector.findOne({ assetId: S.web }).lean<any>();
    expect(col.latestReport.containers[0].image).toBe("registry.example/app:1");
    expect(JSON.stringify(col)).not.toContain("user:pass");
  });
  it("ignores samples older than the latest", async () => {
    const r = await ingest(S.token, push(0, {}, -1000 * 60));
    expect(r.json?.data?.duplicate ?? true).toBe(true);
  });
  it("opens exactly one resource alert after sustained CPU pressure, then closes it after recovery", async () => {
    for (let i = 2; i <= 7; i++) expect((await ingest(S.token, push(i))).status).toBe(202);
    const open = (await api("GET", "/alerts?kind=RESOURCE_PRESSURE", "viewer")).data;
    expect(open.total, JSON.stringify((await M.InfraCollector.findOne({ assetId: S.web }).lean<any>())?.ruleState)).toBe(1);
    expect(open.items[0].title).toContain("CPU pressure");
    expect(open.items[0].message).not.toContain("web1.example.test"); // numbers only, no hostnames
    const recovery: unknown[] = [];
    for (let i = 8; i <= 12; i++) recovery.push((await ingest(S.token, push(i, { cpu: { user: 1000 + 7 * 900 + (i - 7) * 10, nice: 0, system: 200 + i * 40, idle: 8000 + 7 * 60 + (i - 7) * 5000, iowait: 0, irq: 0, softirq: 0, steal: 0 } }))).json);
    const msg = JSON.stringify({ recovery, rule: (await M.InfraCollector.findOne({ assetId: S.web }).lean<any>())?.ruleState?.cpu });
    expect((await api("GET", "/alerts?kind=RESOURCE_PRESSURE&state=RESOLVED", "viewer")).data.total, msg).toBe(1);
  });
  it("serves health, latest values and bucketed history with gaps", async () => {
    const st = (await api("GET", `/assets/${S.web}/monitoring`, "viewer")).data;
    expect(st.state).toMatch(/online|stale/);
    expect(st.latest.memUsedPct).toBeCloseTo(62.5, 1);
    expect(st.host.os).toBe("Ubuntu 24.04");
    expect(st.health.dimensions.length).toBeGreaterThan(0);
    const m = (await api("GET", `/assets/${S.web}/metrics?range=1h`, "viewer")).data;
    expect(m.bucketSeconds).toBeGreaterThan(0);
    expect(m.points.length).toBeGreaterThan(5);
    expect(m.points.some((p: any) => p.cpuAvg !== null)).toBe(true);
    expect(m.points.some((p: any) => p.cpuAvg === null)).toBe(true); // gaps are explicit nulls
    expect((await api("GET", `/assets/${S.web}/metrics?range=99y`, "viewer")).json.code).toBe("infra_invalid_range");
    const fleetM = (await api("GET", "/metrics/fleet?range=1h", "viewer")).data;
    expect(fleetM.serversReporting).toBe(1);
    const f = (await api("GET", "/servers/fleet", "viewer")).data;
    expect(f.summary.total).toBeGreaterThanOrEqual(2);
    const row = f.items.find((i: any) => i.id === S.web);
    expect(row.monitoring).toMatch(/online|stale/);
    expect(f.items.find((i: any) => i.id === S.imported).cpuPct).toBeNull(); // unmonitored is never 0%
  });
  it("validates and saves thresholds", async () => {
    expect((await api("PUT", "/monitoring/thresholds", "super", { cpuPct: 5 })).json.code).toBe("infra_invalid_threshold");
    expect((await api("PUT", "/monitoring/thresholds", "super", { nope: 5 })).json.code).toBe("infra_unknown_threshold");
    expect((await api("PUT", "/monitoring/thresholds", "super", { diskWarnPct: 90, diskCritPct: 80 })).json.code).toBe("infra_invalid_threshold");
    const ok = await api("PUT", "/monitoring/thresholds", "super", { cpuPct: 70 });
    expect(ok.data.cpuPct).toBe(70);
    expect((await api("GET", "/monitoring/thresholds", "viewer")).data.cpuPct).toBe(70);
    await api("PUT", "/monitoring/thresholds", "super", { cpuPct: 85 });
  });
  it("raises a collector-offline alert once per silence and resolves it when samples resume", async () => {
    await M.InfraCollector.updateOne({ assetId: S.web }, { $set: { lastSampleAt: new Date(Date.now() - 20 * 60_000) } });
    const { sweepMonitoring } = await import("../../src/modules/infrastructure/infra.monitoring");
    await sweepMonitoring();
    await sweepMonitoring();
    expect((await api("GET", "/alerts?kind=COLLECTOR_OFFLINE", "viewer")).data.total).toBe(1);
    expect((await api("GET", `/assets/${S.web}/monitoring`, "viewer")).data.state).toBe("offline");
    await ingest(S.token, push(40, {}, Date.now() - T0));
    expect((await api("GET", "/alerts?kind=COLLECTOR_OFFLINE&state=RESOLVED", "viewer")).data.total).toBe(1);
  });
  it("rotates and revokes tokens", async () => {
    const old = S.token;
    const rot = await api("POST", `/assets/${S.web}/collector`, "super", {});
    expect(rot.data.rotated).toBe(true);
    expect((await ingest(old, push(50, {}, Date.now() - T0))).status).toBe(401);
    S.token = rot.data.token;
    expect((await api("DELETE", `/assets/${S.web}/collector`, "super")).data.revoked).toBe(true);
    expect((await ingest(S.token, push(51, {}, Date.now() - T0))).status).toBe(401);
    expect((await api("DELETE", `/assets/${S.web}/collector`, "super")).status).toBe(404);
    expect((await api("GET", `/assets/${S.web}/monitoring`, "viewer")).data.state).toBe("revoked");
  });
  it("rate-limits a single collector's pushes", async () => {
    const c = await api("POST", `/assets/${S.imported}/collector`, "super", {});
    const tok = c.data.token;
    process.env.INFRA_INGEST_RATE_PER_MIN = "20"; // the production default
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await ingest(tok, push(0, {}, 100))).status);
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(5);
    process.env.INFRA_INGEST_RATE_PER_MIN = "5000";
  });
});

describe("background scheduler", () => {
  it("lets exactly one instance take a lease", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => sched.acquireLease("test-lease", 60_000)));
    expect(results.filter(Boolean)).toHaveLength(1);
    await sched.releaseLease("test-lease");
    expect(await sched.acquireLease("test-lease", 60_000)).toBe(true);
    await sched.releaseLease("test-lease");
  });
  it("re-acquires an expired lease", async () => {
    expect(await sched.acquireLease("expiring", 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(await sched.acquireLease("expiring", 60_000)).toBe(true);
  });
  it("runs a sweep that only does due work", async () => {
    await M.InfraAsset.updateOne({ _id: S.domain }, { $set: { "domain.rdapCheckedAt": new Date(Date.now() - 48 * 3_600_000) } });
    const r = await sched.sweepIfLeader();
    expect(r.ran).toBe(true);
    expect(r.stats!.rdap).toBeGreaterThanOrEqual(1);
    const again = await sched.runSweep();
    expect(again.rdap).toBe(0); // everything was just refreshed
    expect(again.errors).toBe(0);
  });
  it("skips the sweep when another instance holds the lease", async () => {
    expect(await sched.acquireLease("sweep", 60_000)).toBe(true);
    expect((await sched.sweepIfLeader()).ran).toBe(false);
    await sched.releaseLease("sweep");
  });
  it("lists scheduler activity", async () => {
    const act = (await api("GET", "/activity", "viewer")).data;
    expect(act.length).toBeGreaterThan(0);
    expect(act.some((a: any) => a.kind === "RDAP" && a.trigger === "scheduled")).toBe(true);
    expect(act.some((a: any) => a.kind === "PROVIDER_SYNC")).toBe(true);
  });
});

describe("reports", () => {
  it("generates a JSON report, a PDF, and deletes it", async () => {
    expect((await api("POST", "/reports", "viewer", { period: "weekly" })).status).toBe(403);
    expect((await api("POST", "/reports", "manager", { period: "forever" })).json.code).toBe("infra_report_period");
    expect((await api("POST", "/reports", "manager", { period: "custom", from: "2026-01-01", to: "2020-01-01" })).status).toBe(400);
    const c = await api("POST", "/reports", "biller", { period: "weekly", includeAi: false });
    expect(c.status).toBe(403); // billing manage alone cannot generate
    const m = await api("POST", "/reports", "manager", { period: "weekly", includeAi: false });
    expect(m.status).toBe(202);
    expect(m.data.status).toMatch(/PENDING|RUNNING/);
    expect((await api("POST", "/reports", "manager", { period: "weekly", includeAi: false })).json.code).toBe("infra_report_busy");
    let r: any;
    for (let i = 0; i < 100; i++) {
      r = (await api("GET", `/reports/${m.data.id}`, "manager")).data;
      if (r.status === "READY" || r.status === "FAILED") break;
      await new Promise((x) => setTimeout(x, 100));
    }
    expect(r.error).toBeNull();
    expect(r.status).toBe("READY");
    expect(r.ai.status).toBe("skipped");
    expect(r.includesBilling).toBe(false); // manager cannot see billing -> report has none
    expect(r.facts.billing).toBeNull();
    expect(r.facts.summary.servers).toBeGreaterThanOrEqual(2);
    expect(r.facts.summary.domains).toBeGreaterThanOrEqual(3);
    expect(r.facts.servers.find((s: any) => s.name === "web-one").metrics.samples).toBeGreaterThan(5);
    expect(r.narrative.findings.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain("omi_col_");
    const pdf = await api("GET", `/reports/${m.data.id}/pdf`, "manager");
    expect(pdf.status).toBe(200);
    expect(pdf.res.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.res.headers.get("cache-control")).toContain("no-store");
    expect(pdf.text.slice(0, 5)).toBe("%PDF-");
    expect((await api("GET", "/reports", "manager")).data.some((x: any) => x.id === m.data.id && x.status === "READY")).toBe(true);
    // Non-privileged users see only their own reports; the super admin sees all.
    expect((await api("GET", "/reports", "viewer")).data).toHaveLength(0);
    expect((await api("GET", `/reports/${m.data.id}`, "viewer")).status).toBe(404);
    expect((await api("GET", "/reports", "super")).data.length).toBeGreaterThanOrEqual(1);
    expect((await api("DELETE", `/reports/${m.data.id}`, "viewer")).status).toBe(403);
    expect((await api("DELETE", `/reports/${m.data.id}`, "manager")).status).toBe(200);
    expect((await api("GET", `/reports/${m.data.id}`, "manager")).status).toBe(404);
  });
  it("includes billing only for callers who may see it, and marks stale generation as failed", async () => {
    const b = await api("POST", "/reports", "super", { period: "monthly", includeAi: false });
    expect(b.status).toBe(202);
    let r: any;
    for (let i = 0; i < 100; i++) {
      r = (await api("GET", `/reports/${b.data.id}`, "super")).data;
      if (r.status === "READY" || r.status === "FAILED") break;
      await new Promise((x) => setTimeout(x, 100));
    }
    expect(r.status).toBe("READY");
    expect(r.includesBilling).toBe(true);
    expect(r.facts.billing.payments.length).toBeGreaterThan(0);
    const stale = await M.InfraReport.create({ period: "daily", periodFrom: new Date(), periodTo: new Date(), title: "stale", status: "RUNNING", createdAt: new Date(Date.now() - 30 * 60_000) });
    const { failStaleReports } = await import("../../src/modules/infrastructure/infra.report");
    expect(await failStaleReports()).toBe(1);
    expect((await M.InfraReport.findById(stale._id).lean<any>()).status).toBe("FAILED");
  });
});

describe("indexes, retention and isolation", () => {
  it("has the unique and TTL indexes the design relies on", async () => {
    const idx = async (m: any) => (await m.collection.indexes()).map((i: any) => ({ key: Object.keys(i.key).join(","), unique: Boolean(i.unique), ttl: i.expireAfterSeconds }));
    expect(await idx(M.InfraMetricSample)).toEqual(expect.arrayContaining([{ key: "assetId,ts", unique: true, ttl: undefined }, { key: "ts", unique: false, ttl: 30 * 86400 }]));
    expect(await idx(M.InfraAlert)).toEqual(expect.arrayContaining([{ key: "dedupeKey", unique: true, ttl: undefined }]));
    expect(await idx(M.InfraBillingRecord)).toEqual(expect.arrayContaining([{ key: "subscriptionId,coversDueDate", unique: true, ttl: undefined }]));
    expect(await idx(M.InfraCollector)).toEqual(expect.arrayContaining([{ key: "tokenHash", unique: true, ttl: undefined }]));
    expect(await idx(M.InfraSyncRun)).toEqual(expect.arrayContaining([{ key: "startedAt", unique: false, ttl: 90 * 86400 }]));
  });
  it("uses only infra_-prefixed collections", async () => {
    const mine = M.INFRA_MODELS.map((m: any) => m.collection.collectionName as string);
    expect(mine.every((n) => n.startsWith("infra_"))).toBe(true);
    expect(new Set(mine).size).toBe(mine.length);
    // none of them collides with a collection of the existing application
    const others = Object.values(mongoose.models).filter((m: any) => !M.INFRA_MODELS.includes(m)).map((m: any) => m.collection.collectionName);
    expect(others.filter((n: string) => mine.includes(n))).toEqual([]);
  });
  it("records an audit trail without secrets", async () => {
    const events = await M.InfraAuditEvent.find({}).lean<any[]>();
    expect(events.length).toBeGreaterThan(10);
    expect(JSON.stringify(events)).not.toContain(CONTABO_SECRET);
    expect(JSON.stringify(events)).not.toContain("omi_col_");
    expect(events.some((e) => e.action === "infrastructure.payment.confirmed")).toBe(true);
  });
  it("stores money as Decimal128 with two decimals", async () => {
    const raw = await M.InfraSubscription.findById(S.sub).lean<any>();
    expect(raw.amount.constructor.name).toBe("Decimal128");
    expect(raw.amount.toString()).toBe("1500.50");
  });
  it("answers unknown routes with 404, not a stack trace", async () => {
    const r = await api("GET", "/nope", "super");
    expect(r.status).toBe(404);
    expect(r.text).not.toContain("node_modules");
  });
});
