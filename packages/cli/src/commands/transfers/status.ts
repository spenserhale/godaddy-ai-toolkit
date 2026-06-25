import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface TransferStatusFlags extends OutputFlags {
  readonly "customer-id"?: string;
}

export const transferStatusCommand = buildCommand({
  docs: { brief: "Get the transfer status for a domain" },
  parameters: {
    flags: {
      "customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true },
      ...outputFlags,
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: TransferStatusFlags, domain: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getTransferStatus(domain, flags["customer-id"]), flags));
    } catch (err) { handleError(err); }
  },
});
