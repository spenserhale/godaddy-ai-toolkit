import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface RetryTransferInFlags { readonly "auth-code": string; readonly "customer-id"?: string; readonly "dry-run": boolean; }

export const retryTransferInCommand = buildCommand({
  docs: { brief: "Resubmit the auth code for a transfer-in" },
  parameters: {
    flags: {
      "auth-code": { kind: "parsed", parse: String, brief: "Domain authorization (EPP) code" },
      "customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: RetryTransferInFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would retry transfer-in for ${domain}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.retryTransferIn(domain, { authCode: flags["auth-code"] }, flags["customer-id"]);
      console.log(`Retried transfer-in for ${domain}`);
    } catch (err) { handleError(err); }
  },
});
