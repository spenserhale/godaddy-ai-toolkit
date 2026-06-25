import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface AvailableDomainFlags extends OutputFlags {
  readonly "for-transfer": boolean;
}

export const availableDomainCommand = buildCommand({
  docs: { brief: "Check whether a domain is available" },
  parameters: {
    flags: {
      "for-transfer": { kind: "boolean", brief: "Check availability for transfer", default: false },
      ...outputFlags,
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: AvailableDomainFlags, domain: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.checkAvailability(domain, { forTransfer: flags["for-transfer"] });
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
