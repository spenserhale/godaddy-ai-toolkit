# GoDaddy Toolkit

SDK, CLI, and MCP server for the [GoDaddy API](https://developer.godaddy.com/doc) —
**domains**, **transfers**, **DNS**, **certificates**, and **orders** — in one Bun monorepo.

## Packages

| Package | Description |
|---------|-------------|
| [`@godaddy-toolkit/sdk`](./packages/sdk) | Core SDK with types, API client, and business logic |
| [`@godaddy-toolkit/cli`](./packages/cli) | Command-line interface (Stricli) |
| [`@godaddy-toolkit/mcp`](./packages/mcp) | MCP server for AI assistants (FastMCP) |

The CLI exposes five command groups mirroring the API surface: `domains`,
`transfers`, `dns`, `certificates`, and `orders`. See `AGENTS.md` for the v1/v2
strategy, output-format convention, and exit codes.

## Install the CLI

**macOS and Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/spenserhale/godaddy-ai-toolkit/main/scripts/install.sh | sh
```

The script detects your OS + architecture, downloads the matching binary from
the [latest release](https://github.com/spenserhale/godaddy-ai-toolkit/releases/latest),
verifies its SHA256, and installs to `$HOME/.local/bin/godaddy`. Pin a specific
version with `GODADDY_TOOLKIT_VERSION=v0.1.1` or change the install directory
with `GODADDY_TOOLKIT_INSTALL=$HOME/bin`.

**Windows:** grab `godaddy-windows-x64.exe` from the
[latest release](https://github.com/spenserhale/godaddy-ai-toolkit/releases/latest)
and put it on your `PATH`.

**Updating:** re-run the install command above, or use the built-in:

```sh
godaddy upgrade          # install latest
godaddy upgrade --check  # check without installing
```

`godaddy upgrade` ships in v0.1.1 and later. On v0.1.0, re-run the install
command once to get it.

## Getting Started

```bash
# Install dependencies
bun install

# Configure credentials: copy .env.example -> .env and set
# GODADDY_API_KEY and GODADDY_API_SECRET (create at developer.godaddy.com/keys)
cp .env.example .env

# Build all packages
bun run build

# Run the CLI
bun run dev:cli -- --help

# Run the MCP server (stdio mode for Claude Desktop)
bun run dev:mcp
```

Standalone binaries are published for macOS, Linux, and Windows. The CLI can
also be run from source via `bun run dev:cli`.

## Architecture

```
packages/sdk/     <-- Types, API client, business logic (foundation)
    ^       ^
    |       |
packages/cli/   packages/mcp/
    (Stricli)    (FastMCP)
```

Both the CLI and MCP server are thin wrappers over the SDK. If the REST API
changes, you update the SDK and both consumers get the fix automatically.

## Development

```bash
# Run tests across all packages
bun test

# Build a specific package
cd packages/sdk && bun run build
```

## Adding a New API Operation

1. Add types to `packages/sdk/src/types.ts`
2. Add the client method to `packages/sdk/src/client.ts`
3. Add a CLI command in `packages/cli/src/commands/`
4. Add an MCP tool in `packages/mcp/src/tools/`
