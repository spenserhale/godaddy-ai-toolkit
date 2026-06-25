import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface RenewDomainFlags {
  readonly period?: number;
  readonly yes: boolean;
  readonly "dry-run": boolean;
}

export const renewDomainCommand = buildCommand({
  docs: { brief: "Renew a domain — billable" },
  parameters: {
    flags: {
      period: { kind: "parsed", parse: Number, brief: "Renewal period in years", optional: true },
      yes: { kind: "boolean", brief: "Confirm the billable action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: RenewDomainFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would renew domain ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to renew without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(JSON.stringify(await client.renewDomain(domain, { period: flags.period }), null, 2));
    } catch (err) { handleError(err); }
  },
});
