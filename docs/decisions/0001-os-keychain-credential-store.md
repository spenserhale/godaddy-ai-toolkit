---
title: "0001: Store credentials with Bun.secrets"
description: Shared encrypted persistent credentials for SDK, CLI, and MCP.
status: accepted
date: 2026-11-09
decision-makers: Spenser Hale (requirements), agent (implementation)
---

## Context

GoDaddy requires an API key and secret. Existing persistent configuration stores these in plaintext, including MCP host configuration. The user selected the wide-search-toolkit v0.2.0 implementation as the reference.

## Options considered

Use Bun.secrets, native keyring dependencies, shell credential-store commands, or document external secret injection alone. Native dependencies add install risk; shell commands are platform-specific and can expose values in argv. External injection alone does not meet the requested persistent desktop setup.

## Decision

Use Bun.secrets under service `godaddy-toolkit`, one entry per primary environment name. Keep process env and nearest .env above keychain, and user config below it. Keep synchronous resolveConfig for compatibility and provide async loadConfig for automatic lookup. Read only missing credentials, in parallel; unavailable stores do not crash resolution. Explicit SDK overrides retain highest precedence.

Only CLI auth commands write or delete credentials. Secrets are read through a hidden TTY prompt or explicit stdin, never argv. Migration copies credentials without modifying files. No plaintext fallback or multiple profiles are introduced.

## Consequences

MCP hosts need no env block. Bun 1.3+ is required for keychain operations; Node consumers skip automatic lookup. Linux requires a running Secret Service daemon. macOS may prompt when a different binary reads entries. Keychain storage protects credentials at rest, not against code already running as the user.

## Revisit when

Node-native credential storage or multiple accounts become requirements.

## Links

- [Plan](../ads/plans/2026-11-09-os-keychain-credentials.md)
- [Design spec](../ads/specs/2026-06-24-godaddy-toolkit-design.md)
