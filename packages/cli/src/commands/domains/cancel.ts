import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface CancelDomainFlags {
  readonly yes: boolean;
  readonly "dry-run": boolean;
}

export const cancelDomainCommand = buildCommand({
  docs: { brief: "Cancel (delete) a domain — irreversible" },
  parameters: {
    flags: {
      yes: { kind: "boolean", brief: "Confirm the destructive action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: CancelDomainFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would cancel domain ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to cancel without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.cancelDomain(domain);
      console.log(`Canceled ${domain}`);
    } catch (err) { handleError(err); }
  },
});
