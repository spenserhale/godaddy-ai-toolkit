import { z } from "zod";
import type { FastMCP } from "fastmcp";
import type { CertificateCreate } from "@godaddy-toolkit/sdk";
import { makeClient, toonText } from "./shared.js";

export function registerCertificateTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_create_certificate",
    description: "Create (request) a TLS/SSL certificate (v1). BILLABLE.",
    parameters: z.object({ body: z.record(z.unknown()).describe("Certificate create payload") }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => toonText(await makeClient().createCertificate(args.body as CertificateCreate)),
  });

  server.addTool({
    name: "godaddy_get_certificate",
    description: "Get details for a certificate by id (v1).",
    parameters: z.object({ certificateId: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getCertificate(args.certificateId)),
  });

  server.addTool({
    name: "godaddy_list_certificates",
    description: "List certificates for the authenticated caller (v2).",
    parameters: z.object({ limit: z.number().int().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().listCertificates({ limit: args.limit })),
  });

  server.addTool({
    name: "godaddy_get_certificate_actions",
    description: "Get the action history for a certificate (v1).",
    parameters: z.object({ certificateId: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getCertificateActions(args.certificateId)),
  });

  server.addTool({
    name: "godaddy_download_certificate",
    description: "Download the issued certificate bundle (v1).",
    parameters: z.object({ certificateId: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().downloadCertificate(args.certificateId)),
  });

  server.addTool({
    name: "godaddy_cancel_certificate",
    description: "Cancel a certificate request (v1). DESTRUCTIVE.",
    parameters: z.object({ certificateId: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().cancelCertificate(args.certificateId);
      return toonText({ canceled: args.certificateId });
    },
  });
}
