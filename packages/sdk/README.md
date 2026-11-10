# @godaddy-toolkit/sdk

Typed GoDaddy API client shared by CLI and MCP.

```ts
import { GoDaddyClient, loadConfig } from "@godaddy-toolkit/sdk";
const client = new GoDaddyClient(await loadConfig());
const domains = await client.listDomains();
```

`loadConfig()` resolves process env, nearest `.env`, OS keychain, user config, and defaults, in order. Explicit SDK overrides win. Only missing credentials are requested from Bun.secrets; unavailable stores are reported in `config.keychain`. Node callers skip automatic lookup.

`resolveConfig(overrides)` remains synchronous and never reads keychain. `SecretStore`, `bunSecretStore()`, and `readKeychainValues()` support injection and testing. `loadConfig({ secretStore: null })` disables lookup, as does `GODADDY_KEYCHAIN=0`.

Set credentials through CLI `auth set godaddy`; see [configuration](../../docs/guides/configuration.md) and [security](../../docs/guides/security.md).
