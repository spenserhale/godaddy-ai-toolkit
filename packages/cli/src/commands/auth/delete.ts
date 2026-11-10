import { buildCommand } from "@stricli/core";
import { bunSecretStore, GoDaddyValidationError } from "@godaddy-toolkit/sdk";
import {
  deleteCredentials,
  parseResource,
  selectCredentialKeys,
} from "../../lib/auth.js";
import {
  authOutputFlags,
  emitAuth,
  runAuth,
  type AuthOutputFlags,
} from "../../lib/auth-output.js";
import { resourcePositional, keyFlag, dryRunFlag } from "./shared.js";
interface Flags extends AuthOutputFlags {
  readonly key?: string;
  readonly yes: boolean;
  readonly "dry-run": boolean;
}
export const authDeleteCommand = buildCommand({
  docs: { brief: "Delete OS keychain credentials (requires --yes)" },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      yes: { kind: "boolean", brief: "Confirm deletion", default: false },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: Flags, resourceArg: string) {
    await runAuth(async () => {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);
      if (!flags.yes)
        throw new GoDaddyValidationError(
          "Deleting keychain credentials requires --yes. Run: godaddy auth delete godaddy --yes",
        );
      const result = await deleteCredentials({
        resource,
        keys,
        store: bunSecretStore(),
        dryRun: flags["dry-run"],
      });
      emitAuth(result, flags, () =>
        result.credentials.map((row) => `${row.action} ${row.key}`).join("\n"),
      );
    });
  },
});
