import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface CancelCertificateFlags { readonly yes: boolean; readonly "dry-run": boolean; }

export const cancelCertificateCommand = buildCommand({
  docs: { brief: "Cancel a pending certificate request" },
  parameters: {
    flags: {
      yes: { kind: "boolean", brief: "Confirm the action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Certificate ID", parse: String }] },
  },
  async func(this: void, flags: CancelCertificateFlags, certificateId: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would cancel certificate ${certificateId}`); return; }
    if (!flags.yes) { console.error("Refusing to cancel without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.cancelCertificate(certificateId);
      console.log(`Canceled certificate ${certificateId}`);
    } catch (err) { handleError(err); }
  },
});
