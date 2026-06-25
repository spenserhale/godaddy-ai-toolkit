import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { TransferInBody } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface ValidateTransferFlags { readonly body: string; readonly "customer-id"?: string; readonly "dry-run": boolean; }

export const validateTransferCommand = buildCommand({
  docs: { brief: "Validate a transfer-in request without purchasing" },
  parameters: {
    flags: {
      body: { kind: "parsed", parse: String, brief: "JSON transfer body (TransferInBody)" },
      "customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: ValidateTransferFlags, domain: string) {
    const body = JSON.parse(flags.body) as TransferInBody;
    if (flags["dry-run"]) { console.log(`[dry-run] would validate transfer-in for ${domain}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.validateTransferIn(domain, body, flags["customer-id"]);
      console.log(`Validated transfer-in for ${domain}`);
    } catch (err) { handleError(err); }
  },
});
