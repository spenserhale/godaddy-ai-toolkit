# Godaddy Toolkit

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

> Run from source via `bun run dev:cli` / `bun run dev:mcp`. Compiled/bundled
> output (`bun build` / `--compile`) isn't supported yet — a known Stricli + bun
> bundler issue breaks route resolution.

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
