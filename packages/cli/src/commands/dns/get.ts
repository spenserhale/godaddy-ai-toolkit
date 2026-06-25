import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecordType } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface GetRecordsFlags extends OutputFlags {
  readonly type?: string;
  readonly name?: string;
}

export const getRecordsCommand = buildCommand({
  docs: { brief: "Get DNS records for a domain" },
  parameters: {
    flags: {
      type: { kind: "parsed", parse: String, brief: "Filter by record type (A, CNAME, …)", optional: true },
      name: { kind: "parsed", parse: String, brief: "Filter by record name", optional: true },
      ...outputFlags,
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: GetRecordsFlags, domain: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.getRecords(domain, flags.type as DnsRecordType | undefined, flags.name);
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
