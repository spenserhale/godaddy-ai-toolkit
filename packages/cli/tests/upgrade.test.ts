import { describe, expect, it } from "bun:test";
import { compareSemver, isCompiledBinary, resolveAssetName, runUpgrade, type UpgradeDeps } from "../src/commands/upgrade.js";

class Exit extends Error { constructor(readonly code: number) { super(`exit ${code}`); } }

function deps(overrides: Partial<UpgradeDeps> = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const d: UpgradeDeps = {
    log: (m) => { logs.push(m); },
    error: (m) => { errors.push(m); },
    exit: (code) => { throw new Exit(code); },
    fetch: (async () => Response.json({ tag_name: "v0.2.0" })) as unknown as typeof fetch,
    execPath: "/home/u/.local/bin/godaddy",
    currentVersion: "0.1.0",
    platform: "darwin",
    arch: "arm64",
    writeBinary: async () => {},
    replaceBinary: async () => {},
    ...overrides,
  };
  return { d, logs, errors };
}

describe("upgrade helpers", () => {
  it("maps platforms to release assets", () => {
    expect(resolveAssetName("darwin", "arm64")).toBe("godaddy-darwin-arm64");
    expect(resolveAssetName("win32", "x64")).toBe("godaddy-windows-x64.exe");
    expect(resolveAssetName("freebsd", "x64")).toBeNull();
  });

  it("detects the compiled binary by exec path", () => {
    expect(isCompiledBinary("/usr/local/bin/godaddy")).toBe(true);
    expect(isCompiledBinary("/opt/bin/godaddy.exe")).toBe(true);
    expect(isCompiledBinary("/usr/local/bin/bun")).toBe(false);
  });

  it("compares semver", () => {
    expect(compareSemver("0.1.0", "v0.2.0")).toBe(-1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("runUpgrade", () => {
  it("refuses when not running as the standalone binary", async () => {
    const { d, errors } = deps({ execPath: "/usr/local/bin/bun" });
    await expect(runUpgrade(d, { check: false, force: false, version: undefined })).rejects.toMatchObject({ code: 1 });
    expect(errors.join("\n")).toContain("install.sh");
  });

  it("reports an available update with --check", async () => {
    const { d, logs } = deps();
    await runUpgrade(d, { check: true, force: false, version: undefined });
    expect(logs).toContain("Update available. Run `godaddy upgrade` to install.");
  });

  it("downloads, verifies, and replaces the binary", async () => {
    const bytes = new TextEncoder().encode("binary");
    const sum = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    let replaced = "";
    const { d } = deps({
      fetch: (async (url: string) => {
        if (url.includes("api.github.com")) return Response.json({ tag_name: "v0.2.0" });
        if (url.endsWith(".sha256")) return new Response(`${sum}  godaddy-darwin-arm64`);
        return new Response(bytes);
      }) as unknown as typeof fetch,
      replaceBinary: async (target) => { replaced = target; },
    });
    await runUpgrade(d, { check: false, force: false, version: undefined });
    expect(replaced).toBe("/home/u/.local/bin/godaddy");
  });

  it("rejects a checksum mismatch", async () => {
    const { d } = deps({
      fetch: (async (url: string) => {
        if (url.includes("api.github.com")) return Response.json({ tag_name: "v0.2.0" });
        if (url.endsWith(".sha256")) return new Response("deadbeef  godaddy-darwin-arm64");
        return new Response("binary");
      }) as unknown as typeof fetch,
    });
    await expect(runUpgrade(d, { check: false, force: false, version: undefined })).rejects.toThrow("Checksum mismatch");
  });
});
