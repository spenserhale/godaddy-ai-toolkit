import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecordType } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface DeleteRecordFlags { readonly yes: boolean; readonly "dry-run": boolean; }

export const deleteRecordCommand = buildCommand({
  docs: { brief: "Delete DNS records of a type and name — destructive" },
  parameters: {
    flags: {
      yes: { kind: "boolean", brief: "Confirm the destructive action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [
      { brief: "Domain name", parse: String },
      { brief: "Record type (A, CNAME, …)", parse: String },
      { brief: "Record name", parse: String },
    ] },
  },
  async func(this: void, flags: DeleteRecordFlags, domain: string, type: string, name: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would delete ${type} record ${name} on ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to delete records without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.deleteRecord(domain, type as DnsRecordType, name);
      console.log(`Deleted ${type} record ${name} on ${domain}`);
    } catch (err) { handleError(err); }
  },
});
