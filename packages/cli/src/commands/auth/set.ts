import { buildCommand } from "@stricli/core";
import {
  bunSecretStore,
  loadConfig,
  GoDaddyValidationError,
} from "@godaddy-toolkit/sdk";
import {
  parseResource,
  selectCredentialKeys,
  setCredentials,
} from "../../lib/auth.js";
import {
  authOutputFlags,
  emitAuth,
  runAuth,
  type AuthOutputFlags,
} from "../../lib/auth-output.js";
import {
  promptHidden,
  readAllStdin,
  stdinIsInteractive,
} from "../../lib/prompt.js";
import { resourcePositional, keyFlag, dryRunFlag } from "./shared.js";
interface Flags extends AuthOutputFlags {
  readonly key?: string;
  readonly stdin: boolean;
  readonly "dry-run": boolean;
}
export const authSetCommand = buildCommand({
  docs: {
    brief: "Store credentials in the OS keychain using hidden input or --stdin",
  },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      stdin: {
        kind: "boolean",
        brief: "Read one credential from stdin",
        default: false,
      },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: Flags, resourceArg: string) {
    await runAuth(async () => {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);
      let readValue: (key: string) => Promise<string>;
      if (flags.stdin) {
        if (keys.length > 1)
          throw new GoDaddyValidationError(
            `godaddy uses two keys; --stdin requires --key. Run once per key: ... | godaddy auth set godaddy --key ${keys[0]} --stdin`,
          );
        const value = await readAllStdin();
        readValue = async () => value;
      } else {
        if (!stdinIsInteractive())
          throw new GoDaddyValidationError(
            "No terminal to prompt on. Pipe the value: ... | godaddy auth set godaddy --key GODADDY_API_KEY --stdin",
          );
        readValue = (key) => promptHidden(`${key}: `);
      }
      const config = await loadConfig({
        secretStore: null,
        requireCredentials: false,
      });
      const result = await setCredentials({
        resource,
        keys,
        readValue,
        store: bunSecretStore(),
        config,
        dryRun: flags["dry-run"],
      });
      emitAuth(result, flags, () =>
        result.credentials
          .map(
            (row) =>
              `${row.action} ${row.key} in ${result.store}${row.shadowed_by ? ` (shadowed by ${row.shadowed_by})` : ""}`,
          )
          .join("\n"),
      );
    });
  },
});
