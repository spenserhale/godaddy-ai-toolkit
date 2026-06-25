import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface GetAgreementsFlags extends OutputFlags {
  readonly tlds: string;
  readonly privacy?: boolean;
}

export const getAgreementsCommand = buildCommand({
  docs: { brief: "Get legal agreements for one or more TLDs" },
  parameters: {
    flags: {
      tlds: { kind: "parsed", parse: String, brief: "Comma-separated TLDs (e.g. com,net)" },
      privacy: { kind: "boolean", brief: "Include privacy agreement", optional: true },
      ...outputFlags,
    },
  },
  async func(this: void, flags: GetAgreementsFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.getAgreements(flags.tlds.split(","), { privacy: flags.privacy });
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
