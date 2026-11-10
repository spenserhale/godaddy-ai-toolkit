---
title: Configuration and OS keychain setup
description: Configure GoDaddy credentials once for the SDK, CLI, and MCP server.
---

## Shared resolution

CLI and MCP call the SDK's async `loadConfig()` for every operation. Credential precedence is:

```
explicit SDK overrides > process env > nearest .env > OS keychain > user config > default
```

The resolver walks upward from cwd for the nearest `.env`. User configuration lives at `~/.config/godaddy-toolkit/config.json`, or `$XDG_CONFIG_HOME/godaddy-toolkit/config.json`; `GODADDY_CONFIG_FILE` selects another file. JSON accepts `apiKey`, `apiSecret`, `env`, `baseUrl`, `shopperId`, and `customerId`. Keep secrets out of this plaintext file when using the keychain.

Only missing credential keys are requested from the keychain, in parallel. An explicit process or project credential never triggers a keychain read for that key. `GODADDY_KEYCHAIN=0` (also `false`, `no`, or `off`) disables automatic lookup from process env or `.env`. Unavailable stores report `keychain.status: unavailable` and resolution continues with other sources. Node SDK callers quietly skip automatic lookup.

Bun normally loads `.env` before application startup, which erases the distinction
between file credentials and inherited process env. The repository's `bunfig.toml`,
development scripts, and executable shebangs disable that behavior so this resolver
owns discovery and source tracking. When launching source files from another cwd,
use `bun --no-env-file run ...`, including in MCP host args as shown below. SDK
applications using source tracking or migration should use the same launch flag.
An explicit Bun `--env-file` is process-environment injection and is treated as env.
See [Bun environment loading](https://bun.com/docs/runtime/environment-variables).

## OS keychain setup

Run from source with Bun 1.3 or newer:

```bash
bun install
bun --no-env-file run packages/cli/src/bin.ts auth set godaddy
```

This prompts for `GODADDY_API_KEY` and `GODADDY_API_SECRET` without echoing either. Labels go to stderr; stdout contains structured results. Entries use service `godaddy-toolkit` and the exact environment variable as account name. On macOS, view or delete entries in Keychain Access.app.

Scripts and agents must opt into stdin. GoDaddy needs two credentials, so select one key per pipe:

```bash
pbpaste | bun --no-env-file run packages/cli/src/bin.ts auth set godaddy --key GODADDY_API_KEY --stdin
op read 'op://Private/GoDaddy/secret' | bun --no-env-file run packages/cli/src/bin.ts auth set godaddy --key GODADDY_API_SECRET --stdin
```

Secrets are never accepted as argument or flag values. Non-TTY calls without `--stdin` exit 2; stdin is never read implicitly. Empty input is rejected. `--dry-run` validates without storing. When env or `.env` still wins, output includes `shadowed_by` with that source.

| Command (after `bun --no-env-file run packages/cli/src/bin.ts`) | Behavior |
|---|---|
| `auth set godaddy [--key NAME] [--stdin] [--dry-run]` | Store credentials from hidden prompt or explicit stdin. |
| `auth list [--json\|--csv\|--text]` | Show keychain state and active source without values. |
| `auth delete godaddy [--key NAME] --yes [--dry-run]` | Delete entries; requires confirmation. |
| `auth migrate [--dry-run] [--overwrite]` | Copy active plaintext credentials, skipping existing entries unless overwritten. |
| `config show [--json]` | Redacted configuration, credential sources, and keychain status. |

TOON is the default; auth commands also support JSON, CSV, and text.

## Migrate plaintext credentials

```bash
bun --no-env-file run packages/cli/src/bin.ts auth migrate --dry-run
bun --no-env-file run packages/cli/src/bin.ts auth migrate
# Remove credential entries from files listed in clean_up yourself.
bun --no-env-file run packages/cli/src/bin.ts auth list
bun --no-env-file run packages/cli/src/bin.ts config show --json
```

Migration never edits files and ignores process-env credentials from `op run` or CI. Existing keychain entries are skipped unless `--overwrite` is supplied. A `.env` credential keeps overriding keychain until removed. `clean_up` identifies files containing credentials copied by the command.

## MCP setup (recommended)

After storing both credentials, register the server without an `env` block:

```json
{
  "mcpServers": {
    "godaddy": {
      "command": "bun",
      "args": ["--no-env-file", "run", "/absolute/path/to/godaddy-ai-toolkit/packages/mcp/src/index.ts"]
    }
  }
}
```

Credentials are read on every call, so rotations apply without restarting the host. `get_config_status` reports configured state and sources without contacting GoDaddy or exposing values. No MCP tool writes or deletes secrets. The keychain does not depend on the host's cwd or inherited shell env.

For headless environments, use env or `op run` with `GODADDY_KEYCHAIN=0`. Host `env` blocks still work but literal values remain plaintext at rest.

## Caveats

- **macOS:** a different binary (including after a Bun upgrade or from a GUI MCP host) may show an access dialog. Unlock the login keychain and choose **Always Allow** for the intended binary. Inspect metadata with `security find-generic-password -s godaddy-toolkit -a GODADDY_API_KEY`; do not use flags that print the password in shared output.
- **Linux:** libsecret requires a running Secret Service daemon such as GNOME Keyring or KWallet. Headless servers and CI commonly lack one.
- **Windows:** Bun uses Windows Credential Manager.
- **Runtime:** automatic keychain lookup requires Bun. Node callers can provide credentials explicitly or use other sources. Compiled CLI routing remains unsupported here; use source commands above.
- **Security:** keychain storage protects credentials at rest, not against code already running as your user after access is granted. See [security](security.md).

## SDK usage

```ts
import { GoDaddyClient, loadConfig, resolveConfig } from "@godaddy-toolkit/sdk";

const client = new GoDaddyClient(await loadConfig());
// Synchronous resolution never reads the keychain:
const explicit = resolveConfig({ apiKey: "provided-in-memory", apiSecret: "provided-in-memory" });
```

Use `loadConfig({ secretStore: null })` to disable lookup programmatically. Tests inject a `SecretStore` with `description`, async `get(name)`, `set(name, value)`, and `delete(name)` methods.
