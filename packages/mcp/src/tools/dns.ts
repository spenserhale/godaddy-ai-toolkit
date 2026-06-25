import { z } from "zod";
import type { FastMCP } from "fastmcp";
import type { DnsRecord, DnsRecordType } from "@godaddy-toolkit/sdk";
import { makeClient, toonText } from "./shared.js";

const recordSchema = z
  .object({
    type: z.string(),
    name: z.string(),
    data: z.string(),
    ttl: z.number().optional(),
    priority: z.number().optional(),
  })
  .passthrough();

const recordArray = z.array(recordSchema);

export function registerDnsTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_get_dns_records",
    description: "Get DNS records for a domain, optionally filtered by type and name (v1).",
    parameters: z.object({
      domain: z.string(),
      type: z.string().optional().describe("Record type, e.g. A, CNAME, MX"),
      name: z.string().optional(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) =>
      toonText(await makeClient().getRecords(args.domain, args.type as DnsRecordType | undefined, args.name)),
  });

  server.addTool({
    name: "godaddy_add_dns_records",
    description: "Append DNS records to a domain (v1).",
    parameters: z.object({ domain: z.string(), records: recordArray }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().addRecords(args.domain, args.records as DnsRecord[]);
      return toonText({ added: args.records.length, domain: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_replace_dns_records",
    description: "Replace ALL DNS records for a domain (v1). DESTRUCTIVE.",
    parameters: z.object({ domain: z.string(), records: recordArray }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().replaceRecords(args.domain, args.records as DnsRecord[]);
      return toonText({ replaced: args.records.length, domain: args.domain });
    },
  });

  server.addTool({
    name: "godaddy_replace_dns_records_by_type",
    description: "Replace DNS records of a given type (optionally a name) for a domain (v1).",
    parameters: z.object({
      domain: z.string(),
      type: z.string().describe("Record type, e.g. A, CNAME, MX"),
      records: recordArray,
      name: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().replaceRecordsByType(args.domain, args.type as DnsRecordType, args.records as DnsRecord[], args.name);
      return toonText({ replaced: args.records.length, domain: args.domain, type: args.type });
    },
  });

  server.addTool({
    name: "godaddy_delete_dns_record",
    description: "Delete DNS records of a given type and name for a domain (v1). DESTRUCTIVE.",
    parameters: z.object({
      domain: z.string(),
      type: z.string().describe("Record type, e.g. A, CNAME, MX"),
      name: z.string(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().deleteRecord(args.domain, args.type as DnsRecordType, args.name);
      return toonText({ deleted: args.domain, type: args.type, name: args.name });
    },
  });
}
