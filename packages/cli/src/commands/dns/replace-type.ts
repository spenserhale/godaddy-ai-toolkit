import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecord, DnsRecordType } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface ReplaceRecordsByTypeFlags { readonly records: string; readonly name?: string; readonly yes: boolean; readonly "dry-run": boolean; }

export const replaceRecordsByTypeCommand = buildCommand({
  docs: { brief: "Replace DNS records of a given type (optionally a name) — destructive" },
  parameters: {
    flags: {
      records: { kind: "parsed", parse: String, brief: "JSON array of records of this type" },
      name: { kind: "parsed", parse: String, brief: "Restrict to this record name", optional: true },
      yes: { kind: "boolean", brief: "Confirm the destructive action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [
      { brief: "Domain name", parse: String },
      { brief: "Record type (A, CNAME, …)", parse: String },
    ] },
  },
  async func(this: void, flags: ReplaceRecordsByTypeFlags, domain: string, type: string) {
    const records = JSON.parse(flags.records) as DnsRecord[];
    if (flags["dry-run"]) { console.log(`[dry-run] would replace ${type} record(s) on ${domain} with ${records.length} record(s)`); return; }
    if (!flags.yes) { console.error("Refusing to replace records without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.replaceRecordsByType(domain, type as DnsRecordType, records, flags.name);
      console.log(`Replaced ${type} record(s) on ${domain} with ${records.length} record(s)`);
    } catch (err) { handleError(err); }
  },
});
