import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const listTldsCommand = buildCommand({
  docs: { brief: "List supported TLDs" },
  parameters: {
    flags: { ...outputFlags },
  },
  async func(this: void, flags: OutputFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.listTlds(), flags));
    } catch (err) { handleError(err); }
  },
});
