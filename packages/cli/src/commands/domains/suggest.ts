import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface SuggestDomainsFlags extends OutputFlags {
  readonly limit?: number;
}

export const suggestDomainsCommand = buildCommand({
  docs: { brief: "Suggest available domains for a query" },
  parameters: {
    flags: {
      limit: { kind: "parsed", parse: Number, brief: "Max results", optional: true },
      ...outputFlags,
    },
    positional: { kind: "tuple", parameters: [{ brief: "Search query", parse: String }] },
  },
  async func(this: void, flags: SuggestDomainsFlags, query: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.suggestDomains(query, { limit: flags.limit });
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
