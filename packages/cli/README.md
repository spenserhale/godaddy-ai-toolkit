# @godaddy-toolkit/cli

Run from source with Bun 1.3+:

```bash
bun --no-env-file run packages/cli/src/bin.ts auth set godaddy
bun --no-env-file run packages/cli/src/bin.ts auth list --json
bun --no-env-file run packages/cli/src/bin.ts config show --json
bun --no-env-file run packages/cli/src/bin.ts domains list
```

`auth set` prompts for key and secret without echoing. Scripts use one explicit pipe per credential:

```bash
pbpaste | bun --no-env-file run packages/cli/src/bin.ts auth set godaddy --key GODADDY_API_KEY --stdin
op read 'op://Private/GoDaddy/secret' | bun --no-env-file run packages/cli/src/bin.ts auth set godaddy --key GODADDY_API_SECRET --stdin
```

Use `auth migrate --dry-run` then `auth migrate` to copy plaintext credentials. Remove entries from files listed in `clean_up`; `.env` keeps overriding keychain until removed. `auth delete godaddy --yes` deletes both entries. Mutations support `--dry-run`; secrets never go in argv or output.

TOON is default; auth commands support JSON, CSV, and text. Exit codes: success/dry-run 0, API/network 1, validation 2, config/keychain write 3, not found 4, auth 5, rate limit 6.

See [configuration](../../docs/guides/configuration.md). Set `GODADDY_KEYCHAIN=0` for headless use. Compiled/bundled routing remains unsupported; use source commands.
