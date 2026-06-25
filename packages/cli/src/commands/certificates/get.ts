import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const getCertificateCommand = buildCommand({
  docs: { brief: "Get a certificate by ID" },
  parameters: {
    flags: { ...outputFlags },
    positional: { kind: "tuple", parameters: [{ brief: "Certificate ID", parse: String }] },
  },
  async func(this: void, flags: OutputFlags, certificateId: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getCertificate(certificateId), flags));
    } catch (err) { handleError(err); }
  },
});
