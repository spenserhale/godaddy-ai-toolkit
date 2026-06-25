import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface ListOrdersFlags extends OutputFlags {
  readonly limit?: number;
}

export const listOrdersCommand = buildCommand({
  docs: { brief: "List orders for the account" },
  parameters: {
    flags: {
      limit: { kind: "parsed", parse: Number, brief: "Max results", optional: true },
      ...outputFlags,
    },
  },
  async func(this: void, flags: ListOrdersFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.listOrders({ limit: flags.limit }), flags));
    } catch (err) { handleError(err); }
  },
});
