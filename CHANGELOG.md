# Changelog

## [0.2.0] - 2026-11-09

### Added

- OS keychain credential storage through Bun.secrets, shared by SDK, CLI, and MCP server.
- `auth set`, `auth list`, `auth delete`, and `auth migrate` with hidden input, explicit stdin, dry runs, and redacted output.
- Async `loadConfig()`, nearest `.env` and user-config discovery, source metadata, and `GODADDY_KEYCHAIN=0` for headless environments.
- Redacted `config show` and read-only MCP `get_config_status` diagnostics.
- Configuration and security guides, including MCP setup without an `env` block.

### Changed

- CLI and MCP resolve credentials per call. Precedence: explicit SDK overrides, process env, nearest `.env`, keychain, user config, defaults.
- Source launchers disable Bun's automatic dotenv loading so migration and source tracking distinguish file credentials from inherited env.
- All package, CLI, and MCP versions are 0.2.0. Synchronous `resolveConfig()` remains supported.

### Notes

- Keychain requires Bun 1.3+; Linux needs a running Secret Service daemon. Node SDK callers skip automatic lookup.
- Migration leaves plaintext files untouched; remove copied entries manually. `.env` keeps overriding keychain until removed.
- Run CLI from source with Bun; compiled/bundled route resolution remains unsupported.

## [0.1.1] - 2026-10-21

- Added standalone CLI upgrade support.
