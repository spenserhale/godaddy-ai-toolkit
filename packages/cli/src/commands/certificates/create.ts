import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { CertificateCreate } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface CreateCertificateFlags { readonly body: string; readonly "dry-run": boolean; }

export const createCertificateCommand = buildCommand({
  docs: { brief: "Create (order) an SSL certificate — billable" },
  parameters: {
    flags: {
      body: { kind: "parsed", parse: String, brief: "JSON certificate body (CertificateCreate)" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
  },
  async func(this: void, flags: CreateCertificateFlags) {
    const body = JSON.parse(flags.body) as CertificateCreate;
    if (flags["dry-run"]) { console.log(`[dry-run] would create a certificate`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(JSON.stringify(await client.createCertificate(body), null, 2));
    } catch (err) { handleError(err); }
  },
});
