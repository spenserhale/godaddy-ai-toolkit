import { z } from "zod";
import type { FastMCP } from "fastmcp";
import type { TransferInBody } from "@godaddy-toolkit/sdk";
import { makeClient, toonText } from "./shared.js";

export function registerTransferTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_transfer_in_domain",
    description: "Purchase and start/restart a transfer-in for a domain (v1). BILLABLE.",
    parameters: z.object({
      domain: z.string(),
      body: z.record(z.unknown()).describe("Transfer-in payload (authCode, contacts, etc.)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => toonText(await makeClient().transferInDomain(args.domain, args.body as TransferInBody)),
  });

  server.addTool({
    name: "godaddy_get_transfer_status",
    description: "Get the transfer status for a domain (v2).",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getTransferStatus(args.domain, args.customerId)),
  });

  server.addTool({
    name: "godaddy_validate_transfer_in",
    description: "Validate a transfer-in request without starting it (v2).",
    parameters: z.object({
      domain: z.string(),
      body: z.record(z.unknown()).describe("Transfer-in payload to validate"),
      customerId: z.string().optional(),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().validateTransferIn(args.domain, args.body as TransferInBody, args.customerId);
      return toonText({ validated: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_accept_transfer_in",
    description: "Accept a pending transfer-in for a domain (v2).",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().acceptTransferIn(args.domain, args.customerId);
      return toonText({ accepted: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_cancel_transfer_in",
    description: "Cancel a pending transfer-in for a domain (v2).",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().cancelTransferIn(args.domain, args.customerId);
      return toonText({ canceled: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_retry_transfer_in",
    description: "Resubmit the auth code to retry a transfer-in (v2).",
    parameters: z.object({
      domain: z.string(),
      authCode: z.string(),
      customerId: z.string().optional(),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().retryTransferIn(args.domain, { authCode: args.authCode }, args.customerId);
      return toonText({ retried: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_transfer_out_domain",
    description: "Initiate a transfer-out (ownership change) for a domain (v2). DESTRUCTIVE.",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().transferOutDomain(args.domain, args.customerId);
      return toonText({ transferOut: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_accept_transfer_out",
    description: "Accept a pending transfer-out for a domain (v2).",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().acceptTransferOut(args.domain, args.customerId);
      return toonText({ accepted: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_reject_transfer_out",
    description: "Reject a pending transfer-out for a domain (v2).",
    parameters: z.object({ domain: z.string(), customerId: z.string().optional() }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().rejectTransferOut(args.domain, args.customerId);
      return toonText({ rejected: args.domain });
    },
  });
}
