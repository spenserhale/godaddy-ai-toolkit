import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { GoDaddyConfig } from "./types.js";
import { GoDaddyConfigError } from "./errors.js";
import { bunSecretStore, CREDENTIAL_KEYS, hasBunSecrets, readKeychainValues, type KeychainState, type SecretStore } from "./secrets.js";

export type Env = Record<string, string | undefined>;
export interface ResolvedConfig extends GoDaddyConfig {
  credentialSources: Record<string, string>;
  keychain: KeychainState;
  envFiles: string[];
  configFile: string | null;
  cwd: string;
}
export interface ResolveConfigOptions {
  cwd?: string;
  env?: Env;
  configFile?: string | null;
  requireCredentials?: boolean;
  keychainValues?: Record<string, string>;
  keychain?: KeychainState;
}
export interface LoadConfigOptions extends Omit<ResolveConfigOptions, "keychainValues" | "keychain"> {
  overrides?: Partial<GoDaddyConfig>;
  secretStore?: SecretStore | null;
}

const ENV_BASE_URLS = { prod: "https://api.godaddy.com", ote: "https://api.ote-godaddy.com" } as const;
const ConfigFileSchema = z.object({
  apiKey: z.string().optional(), apiSecret: z.string().optional(),
  baseUrl: z.string().url().optional(), env: z.enum(["prod", "ote"]).optional(),
  shopperId: z.string().optional(), customerId: z.string().optional(),
});

/** The nearest .env is the project override; parent files are not merged. */
function readEnvFile(cwd: string): { path: string | null; values: Env } {
  let current = cwd;
  while (true) {
    const path = join(current, ".env");
    if (existsSync(path)) {
      try { return { path, values: parseEnv(readFileSync(path, "utf8")) }; }
      catch { throw new GoDaddyConfigError(`Could not read .env file: ${path}`); }
    }
    const parent = dirname(current);
    if (parent === current) return { path: null, values: {} };
    current = parent;
  }
}

function parseEnv(text: string): Env {
  const values: Env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?$/);
    if (!match) continue;
    let value = (match[2] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0]; value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    } else value = value.replace(/\s+#.*$/, "").trim();
    values[match[1]!] = value;
  }
  return values;
}

function readUserConfig(options: ResolveConfigOptions, env: Env, fileEnv: Env) {
  if (options.configFile === null) return null;
  const path = resolve(options.configFile ?? env.GODADDY_CONFIG_FILE ?? fileEnv.GODADDY_CONFIG_FILE ?? join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config"), "godaddy-toolkit", "config.json"));
  if (!existsSync(path)) return null;
  try { return { path, data: ConfigFileSchema.parse(JSON.parse(readFileSync(path, "utf8"))) }; }
  catch { throw new GoDaddyConfigError(`Could not parse config file: ${path}`, "Expected JSON with apiKey, apiSecret, env, baseUrl, shopperId, and customerId fields."); }
}

/** Synchronous resolver; injected keychain values can be supplied by loadConfig(). */
export function resolveConfig(overrides: Partial<GoDaddyConfig> = {}, options: ResolveConfigOptions = {}): ResolvedConfig {
  const cwd = resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const envFile = readEnvFile(cwd);
  const userConfig = readUserConfig(options, env, envFile.values);
  const credentialSources: Record<string, string> = {};
  const fields = { GODADDY_API_KEY: "apiKey", GODADDY_API_SECRET: "apiSecret" } as const;
  const credential = (name: keyof typeof fields): string => {
    const field = fields[name];
    const candidates: Array<[string | undefined, string]> = [
      [overrides[field], "override"], [env[name], "env"],
      [envFile.values[name], `envfile:${envFile.path}`],
      [options.keychainValues?.[name], "keychain"],
      [userConfig?.data[field], `config:${userConfig?.path}`],
    ];
    for (const [value, source] of candidates) if (value) { credentialSources[name] = source; return value; }
    credentialSources[name] = "missing";
    if (options.requireCredentials !== false) throw new GoDaddyConfigError(`${name} is required`, "Run godaddy auth set godaddy, or supply credentials through env or .env.");
    return "";
  };
  const pick = (name: string) => env[name] || envFile.values[name];
  const apiKey = credential("GODADDY_API_KEY");
  const apiSecret = credential("GODADDY_API_SECRET");
  const environment = overrides.env ?? pick("GODADDY_ENV") ?? userConfig?.data.env ?? "prod";
  if (environment !== "prod" && environment !== "ote") throw new GoDaddyConfigError("GODADDY_ENV must be prod or ote");
  const baseUrl = overrides.baseUrl ?? pick("GODADDY_BASE_URL") ?? userConfig?.data.baseUrl ?? ENV_BASE_URLS[environment];
  if (!z.string().url().safeParse(baseUrl).success) throw new GoDaddyConfigError("GODADDY_BASE_URL must be a valid URL");
  return {
    apiKey, apiSecret, baseUrl, env: environment,
    shopperId: overrides.shopperId ?? pick("GODADDY_SHOPPER_ID") ?? userConfig?.data.shopperId,
    customerId: overrides.customerId ?? pick("GODADDY_CUSTOMER_ID") ?? userConfig?.data.customerId,
    credentialSources, keychain: options.keychain ?? { status: "disabled" },
    envFiles: envFile.path ? [envFile.path] : [], configFile: userConfig?.path ?? null, cwd,
  };
}

/** Resolve explicit sources first and consult the keychain only for missing keys. */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  const { secretStore, overrides = {}, ...resolveOptions } = options;
  const cwd = resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const envFile = readEnvFile(cwd);
  const keychainSwitch = env.GODADDY_KEYCHAIN ?? envFile.values.GODADDY_KEYCHAIN;
  const disabled = secretStore === null || ["0", "false", "no", "off"].includes((keychainSwitch ?? "").trim().toLowerCase()) || (secretStore === undefined && !hasBunSecrets());
  if (disabled) return resolveConfig(overrides, { ...resolveOptions, keychain: { status: "disabled" } });
  const explicit: Env = { GODADDY_API_KEY: overrides.apiKey, GODADDY_API_SECRET: overrides.apiSecret };
  const missing = CREDENTIAL_KEYS.filter(name => !explicit[name] && !env[name] && !envFile.values[name]);
  const result = await readKeychainValues(secretStore ?? bunSecretStore(), missing);
  return resolveConfig(overrides, { ...resolveOptions, keychainValues: result.values, keychain: result.error ? { status: result.status, error: result.error } : { status: result.status } });
}
