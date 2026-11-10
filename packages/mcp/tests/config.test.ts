import { afterEach, expect, test } from "bun:test";
import { loadConfig, type SecretStore } from "@godaddy-toolkit/sdk";
import { makeClient } from "../src/tools/shared.js";
import { getConfigStatus } from "../src/tools/config.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

test("MCP client creation reads rotated keychain credentials for each call", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "godaddy-mcp-"));
  temporary.push(cwd);
  const values = new Map([["GODADDY_API_KEY", "first-key"], ["GODADDY_API_SECRET", "test-secret"]]);
  const calls: string[] = [];
  const store: SecretStore = {
    description: "memory",
    async get(name) { calls.push(name); return values.get(name) ?? null; },
    async set(name, value) { values.set(name, value); },
    async delete(name) { return values.delete(name); },
  };
  const loader = () => loadConfig({ cwd, env: {}, configFile: null, secretStore: store });
  const first = await makeClient(loader);
  values.set("GODADDY_API_KEY", "rotated-key");
  const second = await makeClient(loader);
  // Capture transport headers without any network or real keychain access.
  const originalFetch = globalThis.fetch;
  const authorization: string[] = [];
  globalThis.fetch = (async (_url, init) => {
    authorization.push((init?.headers as Record<string, string>).Authorization!);
    return Response.json({ orders: [] });
  }) as typeof fetch;
  try {
    await first.listOrders();
    await second.listOrders();
  } finally { globalThis.fetch = originalFetch; }
  expect(authorization).toEqual(["sso-key first-key:test-secret", "sso-key rotated-key:test-secret"]);
  expect(calls).toHaveLength(4);
});

test("MCP configuration status reports configuration without exposing credentials", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "godaddy-mcp-"));
  temporary.push(cwd);
  const loader = () => loadConfig({ cwd, env: { GODADDY_API_KEY: "hidden-key", GODADDY_API_SECRET: "hidden-secret", GODADDY_KEYCHAIN: "0" }, configFile: null });
  const status = await getConfigStatus(loader);
  expect(status.configured).toBe(true);
  expect(status.keychain.status).toBe("disabled");
  expect(JSON.stringify(status)).not.toContain("hidden-key");
  expect(JSON.stringify(status)).not.toContain("hidden-secret");
  expect(status.credentialSources.GODADDY_API_KEY).toBe("env");
});

test("MCP configuration status works before any credentials are configured", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "godaddy-mcp-"));
  temporary.push(cwd);
  const status = await getConfigStatus(() => loadConfig({
    cwd, env: { GODADDY_KEYCHAIN: "0" }, configFile: null, requireCredentials: false,
  }));
  expect(status.configured).toBe(false);
  expect(status.keychain.status).toBe("disabled");
});
