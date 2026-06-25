import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DomainContact } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface UpdateContactsFlags { readonly contacts: string; readonly "dry-run": boolean; }

export const updateDomainContactsCommand = buildCommand({
  docs: { brief: "Update the contacts on a domain" },
  parameters: {
    flags: {
      contacts: { kind: "parsed", parse: String, brief: "JSON object of contacts, e.g. '{\"contactAdmin\":{...}}'" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: UpdateContactsFlags, domain: string) {
    const contacts = JSON.parse(flags.contacts) as Record<string, DomainContact>;
    if (flags["dry-run"]) { console.log(`[dry-run] would update contacts on ${domain}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.updateDomainContacts(domain, contacts);
      console.log(`Updated contacts on ${domain}`);
    } catch (err) { handleError(err); }
  },
});
