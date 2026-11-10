# @godaddy-toolkit/mcp

FastMCP stdio server for GoDaddy domains, transfers, DNS, certificates, and orders.
Run with Bun 1.3+. Store credentials once with a hidden prompt:

```bash
bun --no-env-file run packages/cli/src/bin.ts auth set godaddy
```

## Tools

| Tool | Description |
|------|-------------|
| `get_config_status` | Redacted configured state, credential sources, and keychain status |
| Domain, transfer, DNS, certificate, and order tools | Shared SDK API operations |

Every tool call uses async `loadConfig()`, so rotated keychain credentials apply
without restarting the host. No tool writes or deletes credentials.

## Setup with Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "godaddy-toolkit": {
      "command": "bun",
      "args": ["--no-env-file", "run", "/absolute/path/to/godaddy-ai-toolkit/packages/mcp/src/index.ts"]
    }
  }
}
```

No `env` block is needed after keychain setup. Process env and nearest `.env`
override keychain; keychain overrides user config. Linux needs a running Secret
Service daemon; macOS may show an access dialog for the host's Bun binary
(choose Always Allow for the intended binary). For headless use, set
`GODADDY_KEYCHAIN=0` and inject env through your host or `op run`.

See [configuration](../../docs/guides/configuration.md) and
[security](../../docs/guides/security.md).

## Development

```bash
# Run in stdio mode
bun run dev

# Inspect with FastMCP inspector
bun run inspect
```
