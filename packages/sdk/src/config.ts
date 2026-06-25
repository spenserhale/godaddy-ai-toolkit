import type { GoDaddyConfig } from "./types.js";

const ENV_BASE_URLS: Record<"prod" | "ote", string> = {
  prod: "https://api.godaddy.com",
  ote: "https://api.ote-godaddy.com",
};

export function resolveConfig(overrides: Partial<GoDaddyConfig> = {}): GoDaddyConfig {
  const apiKey = overrides.apiKey ?? process.env["GODADDY_API_KEY"] ?? "";
  const apiSecret = overrides.apiSecret ?? process.env["GODADDY_API_SECRET"] ?? "";
  if (!apiKey) throw new Error("GODADDY_API_KEY is required");
  if (!apiSecret) throw new Error("GODADDY_API_SECRET is required");

  const env = (overrides.env ?? (process.env["GODADDY_ENV"] as "prod" | "ote" | undefined) ?? "prod");
  const baseUrl =
    overrides.baseUrl ??
    process.env["GODADDY_BASE_URL"] ??
    ENV_BASE_URLS[env] ??
    ENV_BASE_URLS.prod;

  return {
    apiKey,
    apiSecret,
    baseUrl,
    env: env === "ote" ? "ote" : "prod",
    shopperId: overrides.shopperId ?? process.env["GODADDY_SHOPPER_ID"],
    customerId: overrides.customerId ?? process.env["GODADDY_CUSTOMER_ID"],
  };
}
