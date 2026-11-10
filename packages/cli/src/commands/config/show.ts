import { buildCommand } from "@stricli/core";
import { loadConfig } from "@godaddy-toolkit/sdk";
import {
  authOutputFlags,
  emitAuth,
  runAuth,
  type AuthOutputFlags,
} from "../../lib/auth-output.js";
export const configShowCommand = buildCommand({
  docs: {
    brief: "Show resolved configuration with credential values redacted",
  },
  parameters: { flags: authOutputFlags },
  async func(this: void, flags: AuthOutputFlags) {
    await runAuth(async () => {
      const config = await loadConfig({ requireCredentials: false });
      const redacted = {
        ...config,
        apiKey: config.apiKey ? "set" : "missing",
        apiSecret: config.apiSecret ? "set" : "missing",
      };
      emitAuth(redacted, flags, () => JSON.stringify(redacted, null, 2));
    });
  },
});
