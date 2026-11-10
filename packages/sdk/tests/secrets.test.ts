import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveConfig, type SecretStore, readKeychainValues, bunSecretStore, GoDaddyConfigError } from "../src/index.js";

const dirs: string[] = [];
function directory() { const path = mkdtempSync(join(tmpdir(), "godaddy-secrets-")); dirs.push(path); return path; }
afterEach(() => { for (const path of dirs.splice(0)) rmSync(path, { recursive: true, force: true }); });
function memory(values: Record<string, string> = {}) {
  const gets: string[] = [];
  const store: SecretStore = { description: "memory", async get(name) { gets.push(name); return values[name] ?? null; }, async set(name, value) { values[name] = value; }, async delete(name) { const had = name in values; delete values[name]; return had; } };
  return { store, gets };
}
const keys = { GODADDY_API_KEY: "keychain-key", GODADDY_API_SECRET: "keychain-secret" };

describe("keychain configuration", () => {
  it("resolves credentials from an injected keychain", async () => {
    const { store } = memory(keys);
    const config = await loadConfig({ cwd: directory(), env: {}, configFile: null, secretStore: store });
    expect(config.apiKey).toBe(keys.GODADDY_API_KEY);
    expect(config.apiSecret).toBe(keys.GODADDY_API_SECRET);
    expect(config.credentialSources.GODADDY_API_KEY).toBe("keychain");
    expect(config.keychain.status).toBe("ok");
  });
  it("keeps process env above nearest .env above keychain above config", async () => {
    const cwd = directory(); const child = join(cwd, "child"); mkdirSync(child);
    const file = join(cwd, "config.json"); writeFileSync(file, JSON.stringify({ apiKey: "config-key", apiSecret: "config-secret" }));
    writeFileSync(join(cwd, ".env"), "GODADDY_API_KEY=parent-key\n");
    writeFileSync(join(child, ".env"), "GODADDY_API_KEY=file-key\n");
    const { store } = memory(keys);
    const base = { cwd: child, configFile: file, secretStore: store };
    expect((await loadConfig({ ...base, env: { GODADDY_API_KEY: "env-key" } })).apiKey).toBe("env-key");
    const config = await loadConfig({ ...base, env: {} });
    expect(config.apiKey).toBe("file-key"); expect(config.apiSecret).toBe("keychain-secret");
    expect(config.credentialSources.GODADDY_API_KEY).toBe(`envfile:${join(child, ".env")}`);
    expect((await loadConfig({ ...base, env: {}, secretStore: null })).apiSecret).toBe("config-secret");
  });
  it("requests only keys absent from env, .env, and explicit overrides", async () => {
    const cwd = directory(); writeFileSync(join(cwd, ".env"), "GODADDY_API_KEY=file-key\n");
    const { store, gets } = memory(keys);
    await loadConfig({ cwd, env: {}, configFile: null, secretStore: store });
    expect(gets).toEqual(["GODADDY_API_SECRET"]); gets.length = 0;
    await loadConfig({ cwd, env: {}, configFile: null, secretStore: store, overrides: { apiSecret: "explicit" } });
    expect(gets).toEqual([]);
  });
  for (const value of ["0", "false", "no", "off"]) {
    it(`disables automatic lookup with env switch ${value}`, async () => {
      const { store, gets } = memory(keys);
      const config = await loadConfig({ cwd: directory(), env: { GODADDY_KEYCHAIN: value }, configFile: null, secretStore: store, requireCredentials: false });
      expect(gets).toEqual([]); expect(config.keychain.status).toBe("disabled");
    });
    it(`disables automatic lookup with .env switch ${value}`, async () => {
      const cwd = directory(); writeFileSync(join(cwd, ".env"), `GODADDY_KEYCHAIN=${value}\n`);
      const { store, gets } = memory(keys);
      const config = await loadConfig({ cwd, env: {}, configFile: null, secretStore: store, requireCredentials: false });
      expect(gets).toEqual([]); expect(config.keychain.status).toBe("disabled");
    });
  }
  it("continues with env and config when the keychain throws", async () => {
    const cwd = directory(); const file = join(cwd, "config.json"); writeFileSync(file, JSON.stringify({ apiSecret: "config-secret" }));
    const { store } = memory(); store.get = async () => { throw new Error("locked"); };
    const config = await loadConfig({ cwd, env: { GODADDY_API_KEY: "env-key" }, configFile: file, secretStore: store });
    expect(config.apiKey).toBe("env-key"); expect(config.apiSecret).toBe("config-secret"); expect(config.keychain.status).toBe("unavailable");
  });
  it("retains sync overrides and supports diagnostic missing credentials", () => {
    const options = { cwd: directory(), env: {}, configFile: null };
    expect(resolveConfig({ apiKey: "explicit", apiSecret: "secret" }, options).apiKey).toBe("explicit");
    expect(() => resolveConfig({}, options)).toThrow(GoDaddyConfigError);
    expect(resolveConfig({}, { ...options, requireCredentials: false }).apiKey).toBe("");
  });
  it("reads a user config from XDG_CONFIG_HOME", async () => {
    const cwd = directory(); const root = directory(); mkdirSync(join(root, "godaddy-toolkit"));
    writeFileSync(join(root, "godaddy-toolkit", "config.json"), JSON.stringify({ apiKey: "config-key", apiSecret: "config-secret" }));
    const config = await loadConfig({ cwd, env: { XDG_CONFIG_HOME: root }, secretStore: null });
    expect(config.apiKey).toBe("config-key"); expect(config.credentialSources.GODADDY_API_KEY).toBe(`config:${config.configFile}`);
  });
});

describe("secret store helpers", () => {
  it("reads in parallel and drops empty values", async () => {
    let pending = 0;
    const store = memory().store;
    store.get = async name => { pending++; await Promise.resolve(); expect(pending).toBe(3); return name === "key" ? "value" : name === "blank" ? "" : null; };
    expect(await readKeychainValues(store, ["key", "blank", "absent"])).toEqual({ status: "ok", values: { key: "value" } });
  });
  it("never throws when a store is unavailable", async () => {
    const store = memory().store; store.get = async () => { throw new Error("unavailable"); };
    expect((await readKeychainValues(store, ["key"])).status).toBe("unavailable");
  });
  it("wraps unavailable runtime operations in typed errors without calling the real store", async () => {
    const secrets = Bun.secrets;
    Reflect.set(Bun, "secrets", undefined);
    try {
      await expect(bunSecretStore().set("key", "sensitive-value")).rejects.toBeInstanceOf(GoDaddyConfigError);
      const config = await loadConfig({ cwd: directory(), env: {}, configFile: null, requireCredentials: false });
      expect(config.keychain.status).toBe("disabled");
    } finally { Reflect.set(Bun, "secrets", secrets); }
  });
  it("wraps backend failures and does not leak backend exception text", async () => {
    const secrets = Bun.secrets;
    const fail = async () => { throw new Error("sensitive-value"); };
    Reflect.set(Bun, "secrets", { get: fail, set: fail, delete: fail });
    try {
      const store = bunSecretStore();
      for (const action of [() => store.get("key"), () => store.set("key", "sensitive-value"), () => store.delete("key")]) {
        try { await action(); throw new Error("Expected keychain failure"); }
        catch (error) {
          expect(error).toBeInstanceOf(GoDaddyConfigError);
          expect(JSON.stringify(error)).not.toContain("sensitive-value");
          expect((error as GoDaddyConfigError).hint).toContain("macOS");
          expect((error as GoDaddyConfigError).hint).toContain("Linux");
        }
      }
      expect(JSON.stringify(await readKeychainValues(store, ["key"]))).not.toContain("sensitive-value");
    } finally { Reflect.set(Bun, "secrets", secrets); }
  });
});
