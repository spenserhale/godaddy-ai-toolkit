import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { TransferInBody } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface TransferInFlags { readonly body: string; readonly yes: boolean; readonly "dry-run": boolean; }

export const transferInCommand = buildCommand({
  docs: { brief: "Purchase and start a transfer-in for a domain — billable" },
  parameters: {
    flags: {
      body: { kind: "parsed", parse: String, brief: "JSON transfer body (TransferInBody)" },
      yes: { kind: "boolean", brief: "Confirm the billable action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: TransferInFlags, domain: string) {
    const body = JSON.parse(flags.body) as TransferInBody;
    if (flags["dry-run"]) { console.log(`[dry-run] would start transfer-in for ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to start transfer-in without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(JSON.stringify(await client.transferInDomain(domain, body), null, 2));
    } catch (err) { handleError(err); }
  },
});
