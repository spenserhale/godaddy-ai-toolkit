import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { makeClient, toonText } from "./shared.js";

export function registerDomainTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_list_domains",
    description: "List domains in the GoDaddy account (v1).",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status, e.g. ACTIVE"),
      limit: z.number().int().optional(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const client = makeClient();
      return toonText(await client.listDomains({ statuses: args.status ? [args.status] : undefined, limit: args.limit }));
    },
  });

  server.addTool({
    name: "godaddy_get_domain",
    description: "Get details for a single domain (v1).",
    parameters: z.object({ domain: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getDomain(args.domain)),
  });

  server.addTool({
    name: "godaddy_check_domain_availability",
    description: "Check if a domain is available to register (v1).",
    parameters: z.object({ domain: z.string(), forTransfer: z.boolean().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().checkAvailability(args.domain, { forTransfer: args.forTransfer })),
  });

  server.addTool({
    name: "godaddy_suggest_domains",
    description: "Suggest available domain names for a query (v1).",
    parameters: z.object({ query: z.string(), limit: z.number().int().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().suggestDomains(args.query, { limit: args.limit })),
  });

  server.addTool({
    name: "godaddy_purchase_domain",
    description: "Purchase/register a domain (v1). BILLABLE. Body must match the TLD purchase schema.",
    parameters: z.object({ body: z.record(z.unknown()).describe("Purchase payload") }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => toonText(await makeClient().purchaseDomain(args.body)),
  });

  server.addTool({
    name: "godaddy_cancel_domain",
    description: "Cancel (delete) a domain (v1). IRREVERSIBLE.",
    parameters: z.object({ domain: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => { await makeClient().cancelDomain(args.domain); return toonText({ canceled: args.domain }); },
  });
}
