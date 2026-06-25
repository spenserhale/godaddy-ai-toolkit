import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const certificateActionsCommand = buildCommand({
  docs: { brief: "List the actions/history for a certificate" },
  parameters: {
    flags: { ...outputFlags },
    positional: { kind: "tuple", parameters: [{ brief: "Certificate ID", parse: String }] },
  },
  async func(this: void, flags: OutputFlags, certificateId: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getCertificateActions(certificateId), flags));
    } catch (err) { handleError(err); }
  },
});
