import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface ListCertificatesFlags extends OutputFlags {
  readonly limit?: number;
}

export const listCertificatesCommand = buildCommand({
  docs: { brief: "List certificates for the caller" },
  parameters: {
    flags: {
      limit: { kind: "parsed", parse: Number, brief: "Max results", optional: true },
      ...outputFlags,
    },
  },
  async func(this: void, flags: ListCertificatesFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.listCertificates({ limit: flags.limit }), flags));
    } catch (err) { handleError(err); }
  },
});
