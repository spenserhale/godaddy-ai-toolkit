import { GoDaddyConfigError } from "./errors.js";

export const KEYCHAIN_SERVICE = "godaddy-toolkit";
export const CREDENTIAL_RESOURCES = ["godaddy"] as const;
export type ResourceId = (typeof CREDENTIAL_RESOURCES)[number];
export const CREDENTIAL_KEYS: readonly string[] = ["GODADDY_API_KEY", "GODADDY_API_SECRET"];

export interface SecretStore {
  readonly description: string;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<boolean>;
}

export function credentialKeys(_resource: ResourceId): readonly string[] { return CREDENTIAL_KEYS; }
export function resourceForCredentialKey(key: string): ResourceId | undefined {
  return CREDENTIAL_KEYS.includes(key) ? "godaddy" : undefined;
}

interface BunSecretsApi {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

export function hasBunSecrets(): boolean {
  return Boolean((globalThis as { Bun?: { secrets?: BunSecretsApi } }).Bun?.secrets);
}

/** OS-native encrypted credential storage; never falls back to plaintext. */
export function bunSecretStore(service = KEYCHAIN_SERVICE): SecretStore {
  const api = (): BunSecretsApi => {
    const secrets = (globalThis as { Bun?: { secrets?: BunSecretsApi } }).Bun?.secrets;
    if (!secrets) throw new GoDaddyConfigError("The OS keychain is not available in this runtime", "Run godaddy with Bun 1.3 or newer, or use env, .env, or op run.");
    return secrets;
  };
  const wrap = async <T>(action: string, operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); }
    catch (error) {
      if (error instanceof GoDaddyConfigError) throw error;
      // Native error messages may include supplied values; never expose them.
      throw new GoDaddyConfigError(`Could not ${action} the OS keychain`, "On macOS, unlock the login keychain and allow access when prompted. On Linux, start a Secret Service daemon (GNOME Keyring or KWallet). Otherwise use env or op run.");
    }
  };
  return {
    description: `os-keychain:${service}`,
    get: name => wrap("read from", () => api().get({ service, name })),
    set: (name, value) => wrap("write to", () => api().set({ service, name, value })),
    delete: name => wrap("delete from", () => api().delete({ service, name })),
  };
}

export type KeychainStatus = "ok" | "disabled" | "unavailable";
export interface KeychainState { status: KeychainStatus; error?: string }
export interface KeychainReadResult { status: "ok" | "unavailable"; values: Record<string, string>; error?: string }

/** Read missing credentials concurrently; unavailability never throws. */
export async function readKeychainValues(store: SecretStore, names: readonly string[]): Promise<KeychainReadResult> {
  try {
    const entries = await Promise.all(names.map(async name => [name, await store.get(name)] as const));
    const values: Record<string, string> = {};
    for (const [name, value] of entries) if (value?.trim()) values[name] = value;
    return { status: "ok", values };
  } catch (error) {
    return { status: "unavailable", values: {}, error: error instanceof GoDaddyConfigError ? error.message : "Could not read the OS keychain" };
  }
}
