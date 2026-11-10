---
title: Credential security
description: Secret input, storage, and test boundaries for GoDaddy Toolkit.
---

## Credential handling

The OS keychain is the persistent credential store with no plaintext fallback. Bun.secrets uses macOS Keychain Services, Linux libsecret, or Windows Credential Manager. Entries use service `godaddy-toolkit` and account names `GODADDY_API_KEY` and `GODADDY_API_SECRET`.

Keys never go in argv: `auth set` accepts only a hidden TTY prompt or explicit `--stdin`. Labels go to stderr and typed characters are not echoed. Commands return actions and sources, never values. `config show` redacts both credentials; `auth list` reports only presence and source.

Process env, `.env`, and user config remain supported. A `.env`, JSON config with credentials, and MCP host `env` block contain plaintext at rest. Prefer keychain on desktops or external injection (`op run`) on headless machines. Migration never edits files: remove entries listed in `clean_up` yourself. Project `.env` still overrides keychain until removed.

## MCP boundary

The server reads credentials per call and exposes no write or delete credential tools. Register it without an `env` block after CLI setup. `get_config_status` returns configured state and sources without secret values.

## Tests and manual checks

Automated tests never touch the real keychain. Unit tests inject in-memory stores; CLI and MCP subprocesses set `GODADDY_KEYCHAIN=0`. Manual keychain checks inspect existing entries first, use dummy values only when entries are absent, and delete only entries created for verification.

The keychain protects secrets at rest, not against code running as the same user once access is granted. macOS may ask for access when the Bun binary changes; Linux needs an unlocked, running Secret Service daemon. See [configuration](configuration.md).
