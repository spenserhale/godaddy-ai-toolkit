import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface ListDomainsFlags extends OutputFlags {
  readonly status?: string;
  readonly limit?: number;
}

export const listDomainsCommand = buildCommand({
  docs: { brief: "List domains in the account" },
  parameters: {
    flags: {
      status: { kind: "parsed", parse: String, brief: "Filter by status (e.g. ACTIVE)", optional: true },
      limit: { kind: "parsed", parse: Number, brief: "Max results", optional: true },
      ...outputFlags,
    },
  },
  async func(this: void, flags: ListDomainsFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.listDomains({
        statuses: flags.status ? [flags.status] : undefined,
        limit: flags.limit,
      });
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
