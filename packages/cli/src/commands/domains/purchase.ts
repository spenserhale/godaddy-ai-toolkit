import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DomainPurchase } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface PurchaseDomainFlags { readonly body: string; readonly "dry-run": boolean; }

export const purchaseDomainCommand = buildCommand({
  docs: { brief: "Purchase a domain — billable" },
  parameters: {
    flags: {
      body: { kind: "parsed", parse: String, brief: "JSON purchase body (DomainPurchase)" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
  },
  async func(this: void, flags: PurchaseDomainFlags) {
    const body = JSON.parse(flags.body) as DomainPurchase;
    if (flags["dry-run"]) { console.log(`[dry-run] would purchase domain ${String(body["domain"] ?? "")}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(JSON.stringify(await client.purchaseDomain(body), null, 2));
    } catch (err) { handleError(err); }
  },
});
