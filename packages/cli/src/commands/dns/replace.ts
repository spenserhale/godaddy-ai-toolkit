import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecord } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface ReplaceRecordsFlags { readonly records: string; readonly yes: boolean; readonly "dry-run": boolean; }

export const replaceRecordsCommand = buildCommand({
  docs: { brief: "Replace ALL DNS records on a domain — destructive" },
  parameters: {
    flags: {
      records: { kind: "parsed", parse: String, brief: "JSON array of records (replaces the full record set)" },
      yes: { kind: "boolean", brief: "Confirm the destructive action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: ReplaceRecordsFlags, domain: string) {
    const records = JSON.parse(flags.records) as DnsRecord[];
    if (flags["dry-run"]) { console.log(`[dry-run] would replace all records on ${domain} with ${records.length} record(s)`); return; }
    if (!flags.yes) { console.error("Refusing to replace all records without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.replaceRecords(domain, records);
      console.log(`Replaced all records on ${domain} with ${records.length} record(s)`);
    } catch (err) { handleError(err); }
  },
});
