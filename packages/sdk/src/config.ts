import type { GodaddyConfig } from "./types.js";

/**
 * Resolve configuration from environment variables.
 * Useful for both CLI and MCP contexts.
 */
export function resolveConfig(
  overrides: Partial<GodaddyConfig> = {}
): GodaddyConfig {
  return {
    apiKey: overrides.apiKey ?? process.env.GODADDY_API_KEY ?? "",
    baseUrl:
      overrides.baseUrl ??
      process.env.GODADDY_BASE_URL ??
      "https://api.godaddy.com",
  };
}
