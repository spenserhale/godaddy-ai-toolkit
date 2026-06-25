import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface AcceptTransferOutFlags { readonly "customer-id"?: string; readonly yes: boolean; readonly "dry-run": boolean; }

export const acceptTransferOutCommand = buildCommand({
  docs: { brief: "Accept a pending transfer-out for a domain" },
  parameters: {
    flags: {
      "customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true },
      yes: { kind: "boolean", brief: "Confirm the action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: AcceptTransferOutFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would accept transfer-out for ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to accept transfer-out without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.acceptTransferOut(domain, flags["customer-id"]);
      console.log(`Accepted transfer-out for ${domain}`);
    } catch (err) { handleError(err); }
  },
});
