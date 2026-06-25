# AGENTS.md

## Purpose

`godaddy-toolkit` is an AI-first integration for the [GoDaddy API](https://developer.godaddy.com/doc) — a typed SDK, an agent-native CLI, and an MCP server, sharing one codebase so types and API logic stay consistent across every way a user (or agent) reaches GoDaddy. This file is the always-on router for coding agents working in this repo: it tells you the commands, the layout, and the GoDaddy-specific conventions to follow.

This repo is one toolkit within the larger `Toolkits/` collection. The shared monorepo architecture is documented one level up in `Toolkits/CLAUDE.md`; this file covers the GoDaddy-specific parts and the essentials needed to work here standalone.

## Quick start

This is a Bun monorepo. Run these from the repo root:

```bash
bun install                 # install workspace deps
bun run build               # build all packages (sdk, cli, mcp)
bun test                    # run all package tests
bun run lint                # tsc --noEmit across all packages

bun run dev:cli -- --help   # run the CLI from source
bun run dev:mcp             # run the MCP server (stdio mode)

# Target one package
bun run --filter '@godaddy-toolkit/sdk' build
```

Config: copy `.env.example` → `.env` and set `GODADDY_API_KEY` and `GODADDY_API_SECRET` (create at https://developer.godaddy.com/keys). Auth uses the `sso-key <key>:<secret>` Authorization header. See `.env.example` for all options.

> **Run from source via bun.** Use `bun run dev:cli` and `bun run dev:mcp`. Compiled/bundled output is **not** supported yet — `bun build` / `--compile` hit a known Stricli + bun bundler issue (`getRoutingTargetForInput`) that breaks route resolution.

## Repo layout

```
packages/sdk/        Foundation: Zod types, HTTP client, config resolver, typed errors
  src/types.ts         Zod schemas + inferred types (the public type surface)
  src/client.ts        GoDaddyClient — wraps fetch, throws typed errors
  src/config.ts        resolveConfig() — env vars -> validated config
  src/errors.ts        GoDaddyError / GoDaddyAuthError / GoDaddyNotFoundError / ...
  src/index.ts         Public exports (cross-package imports come from HERE only)
packages/cli/        Stricli CLI — thin consumer of the SDK
  src/app.ts           Route map (domains / transfers / dns / certificates / orders)
  src/commands/        One file per command, grouped by resource
  src/output.ts        Shared --toon/--json/--csv formatting
  src/handle-error.ts  Typed error -> exit code mapping
packages/mcp/        FastMCP stdio server — thin consumer of the SDK
  src/index.ts         Server bootstrap
  src/tools/           Tool group registrations (one file per resource)
docs/                Planning + reference docs
```

**The SDK is the single source of truth.** CLI and MCP must not contain API logic. When you add an operation: write it once in the SDK, export it from `src/index.ts`, then wire it into both consumers. All cross-package types come from `@godaddy-toolkit/sdk`'s public `index.ts` — never import internal SDK paths.

## API surface

Five resource groups: **domains** (list, get, available, suggest, tlds, agreements, purchase, renew, update-contacts, cancel), **transfers** (in/out + the v2 lifecycle), **dns** (get, add, replace, replace-type, delete), **certificates** (create, get, list, actions, download, cancel), **orders** (list, get).

## v1/v2 API strategy

GoDaddy exposes both `/v1` and `/v2` Domains APIs. **Default to v1.** v2 is used **only** for:

- the **transfer-management lifecycle** (`accept-in`, `cancel-in`, `retry-in`, `accept-out`, `reject-out`, transfer status/validate), and
- the **certificate list** operation.

v2 transfer endpoints are customer-scoped: the path includes a customer UUID. The CLI exposes this as a `--customer-id` argument that **falls back to `GODADDY_CUSTOMER_ID`** when omitted (`requireCustomerId` in the SDK). `customerId` is read from config but only consumed by v2 transfer ops — v1 calls ignore it. Everything else stays on v1 and needs no customer ID.

## Output format convention

**CLI:** All data-returning commands support `--toon` (default), `--json`, and `--csv` via the shared `formatOutput` utility in `packages/cli/src/output.ts`. TOON (`@toon-format/toon`) is the default — token-efficient for LLM consumers.

**MCP:** Tools return TOON-formatted strings via `encode(result)` (`packages/mcp/src/tools/shared.ts`).

## CLI exit codes

Enumerated and consistent with the rest of the `Toolkits/` collection (see `packages/cli/src/handle-error.ts`):

| Code | Meaning            |
|------|--------------------|
| 0    | success / dry-run  |
| 1    | network / API error|
| 2    | validation         |
| 3    | config             |
| 4    | not found          |
| 5    | auth               |
| 6    | rate limit         |

Mutation commands support `--dry-run` (validate without side effects, exits 0) and `--yes`/`--force` for non-interactive confirmation.

## Done criteria

Before finishing any task:

- Run `bun run lint` and `bun test` and fix failures before declaring done. (The SDK has the unit-test suite; CLI/MCP are thin consumers with no unit tests.)
- When you add an SDK operation, confirm it's wired into **both** the CLI and the MCP server (or note explicitly why not).
- Keep new v2 usage limited to the cases above; default new operations to v1.
- If a check was skipped, say why. Flag risky assumptions explicitly.
