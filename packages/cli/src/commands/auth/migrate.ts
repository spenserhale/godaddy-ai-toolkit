import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfig } from "@godaddy-toolkit/sdk";
import { migrateCredentials } from "../../lib/auth.js";
import {
  authOutputFlags,
  emitAuth,
  runAuth,
  type AuthOutputFlags,
} from "../../lib/auth-output.js";
import { dryRunFlag } from "./shared.js";
interface Flags extends AuthOutputFlags {
  readonly overwrite: boolean;
  readonly "dry-run": boolean;
}
export const authMigrateCommand = buildCommand({
  docs: {
    brief:
      "Copy .env/config credentials into the keychain; leave files untouched",
  },
  parameters: {
    flags: {
      overwrite: {
        kind: "boolean",
        brief: "Replace existing keychain entries",
        default: false,
      },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: Flags) {
    await runAuth(async () => {
      const config = await loadConfig({
        secretStore: null,
        requireCredentials: false,
      });
      const result = await migrateCredentials({
        store: bunSecretStore(),
        config,
        dryRun: flags["dry-run"],
        overwrite: flags.overwrite,
      });
      emitAuth(result, flags, () =>
        [
          ...result.credentials.map(
            (row) => `${row.action} ${row.key} (from ${row.from})`,
          ),
          ...result.clean_up.map((path) => `clean_up: ${path}`),
          "Remove migrated credentials from the listed files; .env values keep overriding the keychain until removed.",
        ].join("\n"),
      );
      if (!flags.text && result.clean_up.length)
        console.error(
          "Remove migrated credentials from clean_up files; .env values keep overriding the keychain until removed.",
        );
    });
  },
});
