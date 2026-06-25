import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecord } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface AddRecordsFlags { readonly records: string; readonly "dry-run": boolean; }

export const addRecordsCommand = buildCommand({
  docs: { brief: "Append DNS records to a domain" },
  parameters: {
    flags: {
      records: { kind: "parsed", parse: String, brief: "JSON array of records, e.g. '[{\"type\":\"A\",\"name\":\"@\",\"data\":\"1.2.3.4\"}]'" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: AddRecordsFlags, domain: string) {
    const records = JSON.parse(flags.records) as DnsRecord[];
    if (flags["dry-run"]) { console.log(`[dry-run] would add ${records.length} record(s) to ${domain}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.addRecords(domain, records);
      console.log(`Added ${records.length} record(s) to ${domain}`);
    } catch (err) { handleError(err); }
  },
});
