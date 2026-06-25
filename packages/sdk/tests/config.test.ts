import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { resolveConfig } from "../src/config.js";

const ENV_KEYS = ["GODADDY_API_KEY","GODADDY_API_SECRET","GODADDY_ENV","GODADDY_BASE_URL","GODADDY_SHOPPER_ID","GODADDY_CUSTOMER_ID"];

describe("resolveConfig", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; } });

  it("requires api key and secret", () => {
    expect(() => resolveConfig()).toThrow(/GODADDY_API_KEY/);
    expect(() => resolveConfig({ apiKey: "k" })).toThrow(/GODADDY_API_SECRET/);
  });

  it("defaults to prod base url", () => {
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.baseUrl).toBe("https://api.godaddy.com");
    expect(c.env).toBe("prod");
  });

  it("maps GODADDY_ENV=ote to the OTE base url", () => {
    process.env["GODADDY_ENV"] = "ote";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.baseUrl).toBe("https://api.ote-godaddy.com");
  });

  it("lets an explicit base url override env mapping", () => {
    process.env["GODADDY_ENV"] = "ote";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s", baseUrl: "https://example.test" });
    expect(c.baseUrl).toBe("https://example.test");
  });

  it("reads optional shopper and customer ids from env", () => {
    process.env["GODADDY_SHOPPER_ID"] = "123";
    process.env["GODADDY_CUSTOMER_ID"] = "uuid-1";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.shopperId).toBe("123");
    expect(c.customerId).toBe("uuid-1");
  });
});
