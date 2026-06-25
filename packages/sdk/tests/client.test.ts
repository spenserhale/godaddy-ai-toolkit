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
