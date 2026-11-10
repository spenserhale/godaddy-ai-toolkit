import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { loadConfig, type ResolvedConfig } from "@godaddy-toolkit/sdk";
import { toonText } from "./shared.js";

/** Read-only diagnostics for MCP hosts; credential values never leave the resolver. */
export async function getConfigStatus(
  load: () => Promise<ResolvedConfig> = () => loadConfig({ requireCredentials: false }),
) {
  const config = await load();
  return {
    configured: Boolean(config.apiKey && config.apiSecret),
    credentialSources: config.credentialSources,
    keychain: config.keychain,
  };
}

export function registerConfigTools(server: FastMCP): void {
  server.addTool({
    name: "get_config_status",
    description: "Show whether GoDaddy credentials are configured, their sources, and OS keychain status. Never returns credential values.",
    parameters: z.object({}),
    annotations: { readOnlyHint: true },
    execute: async () => toonText(await getConfigStatus()),
  });
}
