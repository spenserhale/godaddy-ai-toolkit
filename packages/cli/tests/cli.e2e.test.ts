import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve(import.meta.dir, "../src/bin.ts");
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
async function runCli(
  args: string[],
  input?: string,
  env: Record<string, string> = {},
  envFile?: string,
  direct = false,
) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "godaddy-cli-")));
  directories.push(cwd);
  if (envFile !== undefined) writeFileSync(join(cwd, ".env"), envFile);
  const inheritedEnv = { ...process.env };
  delete inheritedEnv.GODADDY_API_KEY;
  delete inheritedEnv.GODADDY_API_SECRET;
  const command = direct ? [cli, ...args] : [process.execPath, "--no-env-file", cli, ...args];
  const child = Bun.spawn(command, {
    cwd,
    env: {
      ...inheritedEnv,
      GODADDY_KEYCHAIN: "0",
      GODADDY_CONFIG_FILE: join(cwd, "absent.json"),
      ...env,
    },
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code, cwd };
}
describe("auth CLI", () => {
  it("disables automatic dotenv through the executable CLI shebang", async () => {
    const result = await runCli(["config", "show", "--json"], undefined, {},
      "GODADDY_API_KEY=file-api-key\nGODADDY_API_SECRET=file-api-secret\n", true);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).credentialSources.GODADDY_API_KEY)
      .toBe(`envfile:${join(result.cwd, ".env")}`);
  });
  it("preserves .env provenance when Bun starts in a project directory", async () => {
    const result = await runCli(["config", "show", "--json"], undefined, {},
      "GODADDY_API_KEY=file-api-key\nGODADDY_API_SECRET=file-api-secret\n");
    expect(result.code).toBe(0);
    const sources = JSON.parse(result.stdout).credentialSources;
    expect(sources.GODADDY_API_KEY).toBe(`envfile:${join(result.cwd, ".env")}`);
    expect(sources.GODADDY_API_SECRET).toBe(`envfile:${join(result.cwd, ".env")}`);
  });
  it("preserves explicit process env provenance when values equal .env", async () => {
    const result = await runCli(["config", "show", "--json"], undefined,
      { GODADDY_API_KEY: "same-api-key", GODADDY_API_SECRET: "same-api-secret" },
      "GODADDY_API_KEY=same-api-key\nGODADDY_API_SECRET=same-api-secret\n");
    expect(result.code).toBe(0);
    const sources = JSON.parse(result.stdout).credentialSources;
    expect(sources.GODADDY_API_KEY).toBe("env");
    expect(sources.GODADDY_API_SECRET).toBe("env");
  });
  it("migrates project .env credentials in dry runs without querying the store", async () => {
    const result = await runCli(["auth", "migrate", "--dry-run", "--overwrite", "--json"], undefined, {},
      "GODADDY_API_KEY=file-api-key\nGODADDY_API_SECRET=file-api-secret\n");
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.credentials.map((row: { action: string }) => row.action)).toEqual(["would_store", "would_store"]);
    expect(payload.clean_up).toEqual([join(result.cwd, ".env")]);
    expect(result.stdout + result.stderr).not.toMatch(/file-api-key|file-api-secret/);
  });
  it("requires explicit stdin without a TTY", async () => {
    const result = await runCli(["auth", "set", "godaddy"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--stdin");
  });
  it("requires --key with stdin for two credentials", async () => {
    const result = await runCli(
      ["auth", "set", "godaddy", "--stdin"],
      "private-value\n",
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--key");
    expect(result.stdout + result.stderr).not.toContain("private-value");
  });
  it("validates piped dry runs without echoing the secret", async () => {
    const result = await runCli(
      [
        "auth",
        "set",
        "godaddy",
        "--key",
        "GODADDY_API_KEY",
        "--stdin",
        "--dry-run",
        "--json",
      ],
      " dry-run-secret\n",
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).credentials[0].action).toBe("would_store");
    expect(result.stdout + result.stderr).not.toContain("dry-run-secret");
  });
  it("requires --yes for deletion even with dry run", async () => {
    for (const flags of [[], ["--dry-run"]]) {
      const result = await runCli(["auth", "delete", "godaddy", ...flags]);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain("--yes");
    }
  });
  it("previews confirmed deletion without accessing the keychain", async () => {
    const result = await runCli([
      "auth",
      "delete",
      "godaddy",
      "--yes",
      "--dry-run",
      "--json",
    ]);
    expect(result.code).toBe(0);
    expect(
      JSON.parse(result.stdout).credentials.map(
        (row: { action: string }) => row.action,
      ),
    ).toEqual(["would_delete", "would_delete"]);
  });
  it("rejects unknown resources", async () => {
    const result = await runCli(["auth", "delete", "other", "--yes"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Unknown resource");
  });
  it("rejects empty piped input", async () => {
    const result = await runCli(
      [
        "auth",
        "set",
        "godaddy",
        "--key",
        "GODADDY_API_SECRET",
        "--stdin",
        "--dry-run",
      ],
      " \n",
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("must not be empty");
  });
  it("lists every key without querying disabled keychain", async () => {
    const result = await runCli(["auth", "list", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.credentials.map((row: { key: string }) => row.key)).toEqual([
      "GODADDY_API_KEY",
      "GODADDY_API_SECRET",
    ]);
    expect(
      payload.credentials.every(
        (row: { keychain: string }) => row.keychain === "unknown",
      ),
    ).toBe(true);
  });
  it("never prints process credentials in config or list", async () => {
    for (const args of [
      ["config", "show", "--json"],
      ["auth", "list", "--json"],
      ["auth", "list", "--csv"],
      ["auth", "list", "--text"],
    ]) {
      const result = await runCli(args, undefined, {
        GODADDY_API_KEY: "never-print-api-key",
        GODADDY_API_SECRET: "never-print-api-secret",
      });
      expect(result.code).toBe(0);
      expect(result.stdout + result.stderr).not.toMatch(
        /never-print-api-key|never-print-api-secret/,
      );
    }
  });
  it("shows redacted config with disabled keychain", async () => {
    const result = await runCli(["config", "show", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.apiKey).toBe("missing");
    expect(payload.apiSecret).toBe("missing");
    expect(payload.keychain.status).toBe("disabled");
  });
});
