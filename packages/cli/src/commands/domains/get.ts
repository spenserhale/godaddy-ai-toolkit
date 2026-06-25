import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const getDomainCommand = buildCommand({
  docs: { brief: "Get a domain by name" },
  parameters: {
    flags: { ...outputFlags },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: OutputFlags, domain: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getDomain(domain), flags));
    } catch (err) { handleError(err); }
  },
});
