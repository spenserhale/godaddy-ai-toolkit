import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface CancelTransferInFlags { readonly "customer-id"?: string; readonly yes: boolean; readonly "dry-run": boolean; }

export const cancelTransferInCommand = buildCommand({
  docs: { brief: "Cancel a pending transfer-in for a domain" },
  parameters: {
    flags: {
      "customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true },
      yes: { kind: "boolean", brief: "Confirm the action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: CancelTransferInFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would cancel transfer-in for ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to cancel transfer-in without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.cancelTransferIn(domain, flags["customer-id"]);
      console.log(`Canceled transfer-in for ${domain}`);
    } catch (err) { handleError(err); }
  },
});
