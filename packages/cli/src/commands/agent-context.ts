import { buildCommand } from "@stricli/core";

const CATALOG = {
  name: "godaddy",
  version: "0.1.0",
  description: "Agent-native CLI for the GoDaddy API",
  env: ["GODADDY_API_KEY", "GODADDY_API_SECRET", "GODADDY_ENV(prod|ote)", "GODADDY_BASE_URL?", "GODADDY_SHOPPER_ID?", "GODADDY_CUSTOMER_ID?"],
  exitCodes: { network: 1, validation: 2, config: 3, notFound: 4, auth: 5, rateLimit: 6, dryRun: 0 },
  groups: {
    domains: ["list","get","available","suggest","tlds","agreements","purchase","renew","update-contacts","cancel"],
    transfers: ["in","status","validate","accept-in","cancel-in","retry-in","out","accept-out","reject-out"],
    dns: ["get","add","replace","replace-type","delete"],
    certificates: ["create","get","list","actions","download","cancel"],
    orders: ["list","get"],
  },
} as const;

export const agentContextCommand = buildCommand({
  docs: { brief: "Print machine-readable command catalog (JSON)" },
  parameters: { flags: {} },
  async func(this: void) { console.log(JSON.stringify(CATALOG, null, 2)); },
});
