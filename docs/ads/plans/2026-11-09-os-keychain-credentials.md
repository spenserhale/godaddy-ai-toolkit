---
title: OS keychain credentials
description: Shared Bun.secrets credential resolution and CLI management.
status: done
date: 2026-11-09
size: large
---

## Intent

Implement the user's specified v0.2.0 reference design for GoDaddy's API key and secret, including release v0.2.0. Reference: spenserhale/wide-search-toolkit v0.2.0, commit 043f4d30a033eed701a56c331c5f24fa0f588e44.

## Acceptance criteria

- In-memory SDK tests prove precedence, missing-only reads, disabled lookup, and unavailable stores.
- CLI unit tests prove trimming, redaction, dry runs, shadowing, and migration; subprocess tests prove explicit stdin and exit codes.
- Every API command/tool loads current credentials; MCP exposes no credential mutations.
- Guides, package READMEs, spec, environment example, catalog, decision, changelog, and all versions agree.
- Full tests and lint pass before commits and release.

## Non-goals

No plaintext fallback, profiles, aliases, file editing during migration, or new GoDaddy API operations.

## Design

Use service `godaddy-toolkit`, resource `godaddy`, and entries `GODADDY_API_KEY` and `GODADDY_API_SECRET`. Copy the reference's store interface, parallel reads, injected auth logic, and hidden prompt. Add nearest `.env` and optional user JSON config discovery because this repository currently lacks them. Resolve explicit SDK overrides first, then process env, nearest `.env`, keychain, config, defaults. Keep `resolveConfig(overrides, options)` synchronous and requiring credentials by default; `loadConfig(options)` accepts `overrides` and `requireCredentials: false` for auth/diagnostics. Return `ResolvedConfig extends GoDaddyConfig` with credentialSources, keychain, envFiles, configFile, cwd. CLI and MCP use async loading for each operation.

Errors from keychain writes are typed configuration errors (exit 3). Reads return unavailable metadata and continue. SDK consumers on Node skip default lookup. A disabled lookup prevents automatic loading; explicit auth commands still address the store. Tests inject stores and disable automatic keychain access in subprocesses.

## Spec delta

- D1 ADDED: shared credential precedence and keychain status, with Bun-only lookup and graceful failure.
- D2 ADDED: auth set/list/delete/migrate and redacted config show.
- D3 MODIFIED: CLI and MCP resolve credentials per call with loadConfig.

## Docs impact

Configuration/security guides, root and package READMEs, design spec, .env.example, AGENTS.md environment context, CLI catalog, changelog, and release notes. No generated skill exists in this repository.

## Decisions

- [OS credential store](../../decisions/0001-os-keychain-credential-store.md)

## Rulings

- [compatibility] retain resolveConfig(overrides) and required credentials by default; diagnostic callers opt out — cost if wrong: low, additive options can evolve.
- [configuration] use ~/.config/godaddy-toolkit/config.json (XDG_CONFIG_HOME supported), with apiKey/apiSecret JSON fields — cost if wrong: medium, users would migrate paths.
- [docs] preserve existing docs/ads spec and plan directories; create docs/decisions and docs/guides — cost if wrong: low, files move.
- [workspace] use a feature branch in the provided workspace — cost if wrong: low, no concurrent checkout writes exist.
- [runtime] disable Bun automatic dotenv loading in entrypoint shebangs, dev scripts, repository bunfig, and documented source launches — Bun otherwise erases credential provenance before resolver startup — cost if wrong: medium, migration may skip file credentials in custom launchers that omit the flag.
- [dotenv] read only the nearest .env file, rather than merging ancestor files — follows the requested nearest-file precedence — cost if wrong: low, inherited parent values require explicit env injection.
- [lockfile] corrected three stale workspace version fields after Bun preserved 0.1.0 through both normal and forced lockfile installs — cost if wrong: low, frozen-lockfile verification passes.
- [commits] ship SDK, CLI, MCP, tests, docs, and version changes as one integrated feature commit after the plan commit — credential resolution is a shared public contract — cost if wrong: low, individual changes remain reviewable by path.

## Tasks

**Goal:** encrypted persistent credentials shared by all surfaces.
**Tech stack:** Bun, TypeScript, Zod, Stricli, FastMCP.
**Detail:** contracts.
**Verify:** fast `bun test <file>`; full `bun test` and `bun run lint` (baseline 28 tests passes).

### T1: SDK store and resolver · design · standard model

**Owns:** packages/sdk/src/{secrets,config,errors,index}.ts, packages/sdk/tests/secrets.test.ts.
**Depends on:** none.
**Produces:** SecretStore, CREDENTIAL_KEYS, credentialKeys(resource), resourceForCredentialKey(key), loadConfig(options), ResolvedConfig, GoDaddyConfigError.
**Tests:** fast. Keychain-only config; full precedence; missing-only reads; every false switch from env/.env; unavailable store; Node skip; typed store errors.
**Review:** yes, credential security.
**Docs:** shared spec D1 and configuration guide resolver section.
**Commit:** feat(sdk): resolve credentials from OS keychain.

### T2: Auth CLI logic and commands · design · standard model

**Owns:** packages/cli/src/lib/*, packages/cli/src/commands/auth/*, packages/cli/src/commands/config/*, packages/cli/tests/auth.test.ts, packages/cli/tests/cli.e2e.test.ts.
**Depends on:** T1 contract; tests execute after T1.
**Consumes:** T1 exports; loadConfig({requireCredentials:false,secretStore:null}) returns empty credential strings and missing sources.
**Produces:** thin Stricli commands authSetCommand/authListCommand/authDeleteCommand/authMigrateCommand/configShowCommand.
**Tests:** fast. All user-specified auth unit and CLI subprocess cases; no keychain access in tests.
**Review:** yes, secret input/output boundaries.
**Docs:** shared spec D2 and auth guide sections.
**Commit:** feat(cli): manage OS keychain credentials.

### T3: Wire consumers and release documentation · design · standard model

**Owns:** remaining CLI/MCP source, MCP tests, package READMEs, .env.example, AGENTS.md, package versions and lockfile.
**Depends on:** T1, T2.
**Consumes:** async loadConfig and command exports.
**Tests:** full suite, lint, MCP per-call credential rotation test; hidden prompt pseudo-TTY dry run.
**Review:** yes, all consumers and redaction.
**Docs:** shared spec D3, configuration/security guides, changelog.
**Commit:** feat: share keychain credentials across CLI and MCP.

### T4: Verify and release · design · standard model

**Owns:** plan completion, release tag and GitHub release.
**Depends on:** T3.
**Tests:** full suite and lint before committing; independent final review.
**Review:** yes, release consistency.
**Docs:** CHANGELOG.md v0.2.0 section used verbatim as release notes.
**Commit:** chore(release): 0.2.0.

## Deferred

No feature work deferred. Compiled/bundled routing remains the existing unsupported path; use Bun source execution.

## Verification results

- `bun test`: 74 passed, 0 failed, 206 assertions across 7 files.
- `bun run lint`: all three packages passed.
- `bun install` and `bun install --frozen-lockfile`: passed; workspace versions now 0.2.0.
- Independent final review: approved with no actionable findings after the dotenv provenance regression was fixed.
- Manual macOS: auth list first confirmed both entries absent. Stored dummy key and secret via stdin; auth list showed keychain source, config show was redacted with status ok, security metadata lookup found both entries, and a real MCP stdio get_config_status call reported configured without env credentials. Deleted only those dummy entries; final list confirmed both missing.
- Pseudo-TTY hidden prompt dry run: accepted input, exited 0, and never echoed the typed value. Unit tests additionally cover cancellation, pasted chunks, editing, and terminal restoration.
- Automated tests used injected stores or disabled lookup and never accessed the real keychain. No generated skill exists in this repository.
