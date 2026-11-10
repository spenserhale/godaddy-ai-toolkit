import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { promptHidden } from "../src/lib/prompt.js";
import { resolveConfig, type SecretStore } from "@godaddy-toolkit/sdk";
import {
  deleteCredentials,
  listCredentials,
  migrateCredentials,
  parseResource,
  selectCredentialKeys,
  setCredentials,
} from "../src/lib/auth.js";

const directories: string[] = [];
function temp() {
  const path = mkdtempSync(join(tmpdir(), "godaddy-auth-"));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    description: "memory",
    values,
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async set(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      return values.delete(key);
    },
  } satisfies SecretStore & { values: Map<string, string> };
}
function config(env: Record<string, string> = {}) {
  return resolveConfig(
    {},
    { cwd: temp(), env, configFile: null, requireCredentials: false },
  );
}

describe("auth helpers", () => {
  it("validates resources and selected keys", () => {
    expect(parseResource("GoDaddy")).toBe("godaddy");
    expect(() => parseResource("other")).toThrow("Unknown resource");
    expect(selectCredentialKeys("godaddy", undefined)).toEqual([
      "GODADDY_API_KEY",
      "GODADDY_API_SECRET",
    ]);
    expect(selectCredentialKeys("godaddy", "godaddy_api_secret")).toEqual([
      "GODADDY_API_SECRET",
    ]);
    expect(() => selectCredentialKeys("godaddy", "bad")).toThrow(
      "not a credential",
    );
  });
  it("trims input and reports env shadowing without values", async () => {
    const store = memoryStore();
    const result = await setCredentials({
      resource: "godaddy",
      keys: ["GODADDY_API_KEY"],
      readValue: async () => " secret-value \n",
      store,
      config: config({ GODADDY_API_KEY: "shell-value" }),
      dryRun: false,
    });
    expect(store.values.get("GODADDY_API_KEY")).toBe("secret-value");
    expect(result.credentials).toEqual([
      { key: "GODADDY_API_KEY", action: "stored", shadowed_by: "env" },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });
  it("reports envfile shadowing", async () => {
    const cwd = temp();
    writeFileSync(join(cwd, ".env"), "GODADDY_API_SECRET=file-value\n");
    const result = await setCredentials({
      resource: "godaddy",
      keys: ["GODADDY_API_SECRET"],
      readValue: async () => "value",
      store: memoryStore(),
      config: resolveConfig(
        {},
        { cwd, env: {}, configFile: null, requireCredentials: false },
      ),
      dryRun: true,
    });
    expect(result.credentials[0]?.shadowed_by).toBe(
      `envfile:${join(cwd, ".env")}`,
    );
  });
  it("dry run writes nothing and empty input writes nothing", async () => {
    const store = memoryStore();
    const input = {
      resource: "godaddy" as const,
      keys: ["GODADDY_API_KEY"],
      readValue: async () => "v",
      store,
      config: config(),
      dryRun: true,
    };
    expect((await setCredentials(input)).credentials[0]?.action).toBe(
      "would_store",
    );
    expect(store.values.size).toBe(0);
    await expect(
      setCredentials({
        ...input,
        dryRun: false,
        keys: ["GODADDY_API_KEY", "GODADDY_API_SECRET"],
        readValue: async (key) => (key.endsWith("SECRET") ? " \n" : "valid"),
      }),
    ).rejects.toThrow("must not be empty");
    expect(store.values.size).toBe(0);
  });
  it("lists states and sources without secrets, including unavailable stores", async () => {
    const result = await listCredentials(
      memoryStore({ GODADDY_API_SECRET: "private-secret" }),
      config({ GODADDY_API_KEY: "private-key" }),
    );
    expect(result.credentials[0]).toEqual({
      resource: "godaddy",
      key: "GODADDY_API_KEY",
      keychain: "missing",
      active_source: "env",
    });
    expect(result.credentials[1]?.keychain).toBe("set");
    expect(JSON.stringify(result)).not.toMatch(/private-secret|private-key/);
    const unavailable = await listCredentials(
      {
        ...memoryStore(),
        async get() {
          throw new Error("locked");
        },
      },
      config(),
    );
    expect(unavailable.keychain_status).toBe("unavailable");
    expect(
      unavailable.credentials.every((row) => row.keychain === "unknown"),
    ).toBe(true);
  });
  it("deletes stored and absent keys and supports dry run", async () => {
    const store = memoryStore({ GODADDY_API_KEY: "value" });
    const input = {
      resource: "godaddy" as const,
      keys: ["GODADDY_API_KEY", "GODADDY_API_SECRET"],
      store,
      dryRun: true,
    };
    expect(
      (await deleteCredentials(input)).credentials.map((row) => row.action),
    ).toEqual(["would_delete", "would_delete"]);
    expect(store.values.size).toBe(1);
    expect(
      (await deleteCredentials({ ...input, dryRun: false })).credentials.map(
        (row) => row.action,
      ),
    ).toEqual(["deleted", "not_found"]);
  });
  it("migrates file and config credentials, preserves existing entries, supports overwrite", async () => {
    const cwd = temp();
    const envFile = join(cwd, ".env");
    const configFile = join(cwd, "config.json");
    writeFileSync(envFile, "GODADDY_API_KEY=file-key\n");
    writeFileSync(configFile, JSON.stringify({ apiSecret: "config-secret" }));
    const resolved = resolveConfig(
      {},
      { cwd, env: {}, configFile, requireCredentials: false },
    );
    const store = memoryStore({ GODADDY_API_KEY: "existing" });
    const input = { store, config: resolved, dryRun: true, overwrite: false };
    expect(
      (await migrateCredentials(input)).credentials.map((row) => row.action),
    ).toEqual(["skipped_exists", "would_store"]);
    expect(store.values.has("GODADDY_API_SECRET")).toBe(false);
    const result = await migrateCredentials({ ...input, dryRun: false });
    expect(store.values.get("GODADDY_API_KEY")).toBe("existing");
    expect(store.values.get("GODADDY_API_SECRET")).toBe("config-secret");
    expect(result.clean_up).toEqual([configFile]);
    const overwrite = await migrateCredentials({
      ...input,
      dryRun: false,
      overwrite: true,
    });
    expect(store.values.get("GODADDY_API_KEY")).toBe("file-key");
    expect(overwrite.clean_up.sort()).toEqual([envFile, configFile].sort());
    const envResolved = resolveConfig(
      {},
      {
        cwd,
        env: { GODADDY_API_KEY: "from-ci", GODADDY_API_SECRET: "from-op" },
        configFile,
        requireCredentials: false,
      },
    );
    expect(
      (
        await migrateCredentials({
          ...input,
          config: envResolved,
          dryRun: false,
        })
      ).credentials,
    ).toEqual([]);
  });
});

function fakeTerminal() {
  const events = new EventEmitter();
  const rawModes: boolean[] = [];
  const output: string[] = [];
  let paused = false;
  const stdin = Object.assign(events, {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) {
      rawModes.push(mode);
      return stdin;
    },
    setEncoding(_encoding: "utf8") {
      return stdin;
    },
    resume() {
      return stdin;
    },
    pause() {
      paused = true;
      return stdin;
    },
  });
  return {
    stdin,
    stderr: {
      write(text: string) {
        output.push(text);
        return true;
      },
    },
    rawModes,
    output,
    isPaused: () => paused,
  };
}

describe("hidden terminal prompt", () => {
  it("handles pasted characters and backspace without echo and restores terminal", async () => {
    const terminal = fakeTerminal();
    const value = promptHidden("KEY: ", terminal);
    terminal.stdin.emit("data", "paste-secreX\u007ft\r");
    expect(await value).toBe("paste-secret");
    expect(terminal.output.join("")).toBe("KEY: \n");
    expect(terminal.rawModes).toEqual([true, false]);
    expect(terminal.isPaused()).toBe(true);
    expect(terminal.stdin.listenerCount("data")).toBe(0);
  });
  it("cancels on Ctrl-C, removes listeners, and restores raw mode", async () => {
    const terminal = fakeTerminal();
    const value = promptHidden("KEY: ", terminal);
    terminal.stdin.emit("data", "private-value\u0003");
    await expect(value).rejects.toThrow("Cancelled; nothing was stored");
    expect(terminal.output.join("")).not.toContain("private-value");
    expect(terminal.rawModes).toEqual([true, false]);
    expect(terminal.isPaused()).toBe(true);
    expect(terminal.stdin.listenerCount("error")).toBe(0);
  });
  it("restores terminal on input errors and setup errors", async () => {
    const terminal = fakeTerminal();
    const value = promptHidden("KEY: ", terminal);
    terminal.stdin.emit("error", new Error("input failed"));
    await expect(value).rejects.toThrow("nothing was stored");
    expect(terminal.rawModes).toEqual([true, false]);
    expect(terminal.isPaused()).toBe(true);
    const setup = fakeTerminal();
    setup.stdin.setEncoding = () => {
      throw new Error("setup failed");
    };
    await expect(promptHidden("KEY: ", setup)).rejects.toThrow(
      "nothing was stored",
    );
    expect(setup.rawModes).toEqual([true, false]);
    expect(setup.isPaused()).toBe(true);
  });
  it("finishes on Ctrl-D and rejects noninteractive input", async () => {
    const terminal = fakeTerminal();
    const value = promptHidden("KEY: ", terminal);
    terminal.stdin.emit("data", "value\u0004");
    expect(await value).toBe("value");
    expect(terminal.isPaused()).toBe(true);
    const absent = fakeTerminal();
    absent.stdin.isTTY = false;
    await expect(promptHidden("KEY: ", absent)).rejects.toThrow("No terminal");
    expect(absent.rawModes).toEqual([]);
  });
});
