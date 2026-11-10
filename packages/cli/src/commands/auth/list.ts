import { buildCommand } from "@stricli/core";
import {
  bunSecretStore,
  loadConfig,
  type SecretStore,
} from "@godaddy-toolkit/sdk";
import { listCredentials } from "../../lib/auth.js";
import {
  authOutputFlags,
  emitAuth,
  runAuth,
  type AuthOutputFlags,
} from "../../lib/auth-output.js";
export const authListCommand = buildCommand({
  docs: {
    brief: "List keychain states and active credential sources without values",
  },
  parameters: { flags: authOutputFlags },
  async func(this: void, flags: AuthOutputFlags) {
    await runAuth(async () => {
      const config = await loadConfig({ requireCredentials: false });
      // Explicit opt-out also prevents this diagnostic command reading the OS store.
      const store: SecretStore =
        config.keychain.status === "disabled"
          ? {
              description: "os-keychain:godaddy-toolkit (disabled)",
              async get() {
                throw new Error("Keychain lookup disabled");
              },
              async set() {
                throw new Error("Keychain lookup disabled");
              },
              async delete() {
                throw new Error("Keychain lookup disabled");
              },
            }
          : bunSecretStore();
      const result = await listCredentials(store, config);
      emitAuth(result, flags, () =>
        [
          `store: ${result.store} (${result.keychain_status})`,
          ...result.credentials.map(
            (row) =>
              `${row.key} keychain=${row.keychain} active=${row.active_source}`,
          ),
        ].join("\n"),
      );
    });
  },
});
