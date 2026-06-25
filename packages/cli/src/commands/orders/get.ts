import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const getOrderCommand = buildCommand({
  docs: { brief: "Get an order by ID" },
  parameters: {
    flags: { ...outputFlags },
    positional: { kind: "tuple", parameters: [{ brief: "Order ID", parse: String }] },
  },
  async func(this: void, flags: OutputFlags, orderId: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getOrder(orderId), flags));
    } catch (err) { handleError(err); }
  },
});
