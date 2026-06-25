import { describe, expect, it, mock, afterEach } from "bun:test";
import { GoDaddyClient } from "../src/client.js";
import { GoDaddyAuthError, GoDaddyValidationError } from "../src/errors.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown; headers?: Record<string,string> }) {
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const { status = 200, body = "", headers = {} } = handler(String(url), init ?? {});
    const payload = body === "" ? "" : JSON.stringify(body);
    return new Response(payload, { status, headers: { "Content-Type": "application/json", ...headers } });
  }) as unknown as typeof fetch;
}

const client = () => new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test" });

describe("GoDaddyClient domains (read)", () => {
  it("sends sso-key auth header and lists domains", async () => {
    let seenAuth = "";
    stubFetch((url, init) => { seenAuth = (init.headers as Record<string,string>).Authorization; return { body: [{ domain: "a.com", status: "ACTIVE" }] }; });
    const out = await client().listDomains();
    expect(seenAuth).toBe("sso-key k:s");
    expect(out[0]!.domain).toBe("a.com");
  });

  it("maps 401 to GoDaddyAuthError", async () => {
    stubFetch(() => ({ status: 401, body: { code: "UNAUTHORIZED", message: "bad key" } }));
    await expect(client().listDomains()).rejects.toBeInstanceOf(GoDaddyAuthError);
  });

  it("checks availability via query param", async () => {
    let seenUrl = "";
    stubFetch((url) => { seenUrl = url; return { body: { domain: "x.com", available: true } }; });
    const r = await client().checkAvailability("x.com");
    expect(seenUrl).toContain("/v1/domains/available?domain=x.com");
    expect(r.available).toBe(true);
  });
});

describe("GoDaddyClient domains (mutations)", () => {
  it("renews a domain with POST body", async () => {
    let seen = { url: "", method: "", body: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string, body: init.body as string }; return { body: { orderId: 1 } }; });
    await client().renewDomain("a.com", { period: 1 });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/domains/a.com/renew");
    expect(JSON.parse(seen.body).period).toBe(1);
  });

  it("cancels a domain with DELETE", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { status: 204 }; });
    await client().cancelDomain("a.com");
    expect(seen.method).toBe("DELETE");
    expect(seen.url).toContain("/v1/domains/a.com");
  });
});

describe("GoDaddyClient transfers", () => {
  it("initiates transfer-in via v1 (no customerId needed)", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { body: { orderId: 9 } }; });
    await client().transferInDomain("a.com", { authCode: "x" });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/domains/a.com/transfer");
  });

  it("queries transfer status via v2 with customerId from config", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { status: "PENDING" } }; });
    const c = new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test", customerId: "cust-1" });
    await c.getTransferStatus("a.com");
    expect(seen).toContain("/v2/customers/cust-1/domains/a.com/transfer");
  });

  it("prefers an explicit customerId argument over config", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: {} }; });
    const c = new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test", customerId: "cfg" });
    await c.acceptTransferIn("a.com", "arg-cust");
    expect(seen).toContain("/v2/customers/arg-cust/domains/a.com/transferInAccept");
  });

  it("throws GoDaddyValidationError when no customerId is available", async () => {
    stubFetch(() => ({ body: {} }));
    await expect(client().transferOutDomain("a.com")).rejects.toBeInstanceOf(GoDaddyValidationError);
  });
});

describe("GoDaddyClient dns records", () => {
  it("gets records filtered by type and name", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: [{ type: "A", name: "@", data: "1.2.3.4" }] }; });
    const r = await client().getRecords("a.com", "A", "@");
    expect(seen).toContain("/v1/domains/a.com/records/A/%40");
    expect(r[0]!.data).toBe("1.2.3.4");
  });

  it("adds records with PATCH", async () => {
    let method = "";
    stubFetch((_url, init) => { method = init.method as string; return { status: 200 }; });
    await client().addRecords("a.com", [{ type: "TXT", name: "@", data: "hello" }]);
    expect(method).toBe("PATCH");
  });

  it("deletes a record with DELETE", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { status: 204 }; });
    await client().deleteRecord("a.com", "A", "old");
    expect(seen.method).toBe("DELETE");
    expect(seen.url).toContain("/v1/domains/a.com/records/A/old");
  });
});

describe("GoDaddyClient certificates", () => {
  it("creates a certificate via v1", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { body: { certificateId: "c1" } }; });
    await client().createCertificate({ commonName: "a.com" });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/certificates");
  });

  it("lists certificates via v2 (no customerId)", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { certificates: [{ certificateId: "c1" }] } }; });
    const r = await client().listCertificates();
    expect(seen).toContain("/v2/certificates");
    expect(r[0]!.certificateId).toBe("c1");
  });
});

describe("GoDaddyClient orders", () => {
  it("lists orders", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { orders: [{ orderId: 1 }] } }; });
    const r = await client().listOrders();
    expect(seen).toContain("/v1/orders");
    expect(r[0]!.orderId).toBe(1);
  });
});
