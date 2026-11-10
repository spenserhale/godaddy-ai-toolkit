# godaddy-toolkit — Design Spec

**Date:** 2026-06-24
**Status:** Approved (pending spec review)

## Purpose

An AI-first integration for the [GoDaddy API](https://developer.godaddy.com/) — a
typed SDK, an agent-native CLI, and an MCP server sharing one codebase. It is one
toolkit within the larger `Toolkits/` collection and follows the shared
SDK → CLI → MCP architecture documented in `Toolkits/CLAUDE.md`.

The public GitHub repo is **`spenserhale/godaddy-ai-toolkit`** (note: the repo name
differs from the local folder name `godaddy-toolkit`, which keeps the `*-toolkit`
convention of its siblings).

## Architecture

Standard three-layer Bun monorepo, scaffolded with `bun run create-toolkit.ts godaddy`:

```
packages/sdk/   Zod types, GoDaddyClient (fetch wrapper), resolveConfig(), typed errors  ← single source of truth
  src/types.ts    Zod schemas + inferred types (public type surface)
  src/client.ts   GoDaddyClient — wraps fetch, throws typed errors
  src/config.ts   resolveConfig() — env vars -> validated config
  src/errors.ts   typed error classes
  src/index.ts    public exports (cross-package imports come from HERE only)
packages/cli/   Stricli CLI — thin SDK consumer; one file per command
packages/mcp/   FastMCP stdio server — thin SDK consumer; tool groups
```

The SDK is the single source of truth. CLI and MCP contain **no API logic**. Each
new operation is written once in the SDK, exported from `index.ts`, then wired into
both consumers.

## Authentication & Environment

GoDaddy authenticates with an API **key + secret** sent in a single header:

```
Authorization: sso-key {GODADDY_API_KEY}:{GODADDY_API_SECRET}
```

`loadConfig(options)` reads process env, nearest `.env`, OS keychain, user config,
and defaults, in that order; explicit SDK overrides win. `resolveConfig(overrides,
options)` remains synchronous and never reads the keychain. The OS service is
`godaddy-toolkit`, with one entry named exactly `GODADDY_API_KEY` or
`GODADDY_API_SECRET`. Only missing credentials are read, in parallel. Lookup is
Bun-only; Node consumers skip it. `GODADDY_KEYCHAIN=0|false|no|off` disables it
from env or `.env`; failures become `keychain.status: unavailable` metadata.

User JSON config defaults to `~/.config/godaddy-toolkit/config.json`, supports
`XDG_CONFIG_HOME`, and can be overridden with `GODADDY_CONFIG_FILE`. Its fields
are `apiKey`, `apiSecret`, `env`, `baseUrl`, `shopperId`, and `customerId`.
Resolved config includes `credentialSources` (`env`, `envfile:<path>`, `keychain`,
`config:<path>`, or missing), `keychain`, `envFiles`, `configFile`, and `cwd`.
Credentials are required by default; diagnostics opt into `requireCredentials: false`.
Entrypoint shebangs, development scripts, and repository bunfig disable Bun's
automatic dotenv loading. External source launches use `--no-env-file`, so the
resolver can distinguish .env sources from explicit inherited env credentials.

| Env var | Required | Purpose |
|---|---|---|
| `GODADDY_API_KEY` | yes | API key |
| `GODADDY_API_SECRET` | yes | API secret |
| `GODADDY_ENV` | no | `prod` (default) → `https://api.godaddy.com`; `ote` → `https://api.ote-godaddy.com` |
| `GODADDY_BASE_URL` | no | explicit base URL override; wins over `GODADDY_ENV` |
| `GODADDY_SHOPPER_ID` | no | sent as `X-Shopper-Id` header for reseller/sub-account calls |
| `GODADDY_CUSTOMER_ID` | no* | the customer (shopper) GUID; required by all v2 **customer-scoped** paths (`/v2/customers/{customerId}/…`) |

Resolution precedence for base URL: `overrides.baseUrl` → `GODADDY_BASE_URL` →
map(`GODADDY_ENV`) → prod default. Config is validated with a Zod
`GoDaddyConfigSchema`.

\* `GODADDY_CUSTOMER_ID` is **never required up front**. It is only consumed by the
handful of v2-only **transfer-management** operations. Those SDK methods take
`customerId` as an explicit **argument**; when the caller omits it, the method falls
back to `config.customerId` (← `GODADDY_CUSTOMER_ID`). Only if both are absent does
the method throw `GoDaddyValidationError` with a clear message. No v1 operation ever
needs it. `customerId` is a **UUIDv4** (distinct from the numeric shopper id); it can
be looked up via the Shoppers API (`GET /v1/shoppers/{shopperId}?includes=customerId`)
— automatic resolution is out of scope for v1.

## API Versioning Strategy

**Default to v1. Use a v2 endpoint only when the operation has no v1 equivalent.**
v1 is shopper-scoped (the API key identifies the account — no `customerId` in the
path), which is the right fit for managing our own account, and it covers the large
majority of operations. v2 is reached for exactly one capability gap: the **managed
domain transfer lifecycle** (and certificate listing). Concretely:

- **v1 (default — the backbone):** domain list/get/availability/suggest/tlds/
  agreements/purchase/renew/contacts/cancel; transfer-*in* initiation; **all DNS
  record management**; certificate create/get/actions/download/cancel; **all of Orders**.
- **v2 (only where v1 has nothing):** transfer status/validate, transfer-*in*
  accept/cancel/retry, transfer-*out* initiate/accept/reject (all customer-scoped);
  certificate **list** (`GET /v2/certificates`, caller-scoped, no `customerId`).

Each SDK method's doc comment names the exact path + version it calls so the
v1/v2 split is auditable in code. The transfer-in flow inherently spans both — v1
initiates, v2 manages — which is a property of GoDaddy's API, not a design choice.

## Response & Error Conventions

Unlike YNAB, GoDaddy responses are **unwrapped** (no `{ data: ... }` envelope) — the
client returns parsed bodies directly. API errors are shaped
`{ code: string, message: string, fields?: [...] }` (`GoDaddyErrorResponseSchema`).

Status mapping in `client.request()`:

| HTTP | Error class |
|---|---|
| 401 / 403 | `GoDaddyAuthError` |
| 404 | `GoDaddyNotFoundError` |
| 422 | `GoDaddyValidationError` (includes `fields`) |
| 429 | `GoDaddyRateLimitError` (reads `Retry-After`) |
| other !ok | `GoDaddyError` (message, code, statusCode) |

All extend a base `GoDaddyError extends Error` with `code` and `statusCode`.

## API Surface

All endpoints are GoDaddy API **v1**. Mutations are marked **(M)**; billable/
irreversible ones are marked **(!)** and are guarded in the CLI with
`--dry-run`, `--yes`/`--force`, and `--idempotency-key` where applicable.

### Domains — **v1** `/v1/domains`
- `listDomains(params?)` — `GET /v1/domains` (statuses, limit, marker)
- `getDomain(domain)` — `GET /v1/domains/{domain}`
- `checkAvailability(domain, opts?)` — `GET /v1/domains/available?domain=`
- `checkAvailabilityBulk(domains[])` — `POST /v1/domains/available`
- `suggestDomains(query, opts?)` — `GET /v1/domains/suggest`
- `listTlds()` — `GET /v1/domains/tlds`
- `getAgreements(tlds, privacy?)` — `GET /v1/domains/agreements`
- `purchaseDomain(body)` — `POST /v1/domains/purchase` **(M)(!)**
- `updateDomainContacts(domain, contacts)` — `PATCH /v1/domains/{domain}/contacts` **(M)**
- `renewDomain(domain, body?)` — `POST /v1/domains/{domain}/renew` **(M)(!)**
- `cancelDomain(domain)` — `DELETE /v1/domains/{domain}` **(M)(!)**

### Domain Transfers (in & out)
- `transferInDomain(domain, body)` — **v1** `POST /v1/domains/{domain}/transfer` **(M)(!)** — purchase & start/restart a transfer-in
- `getTransferStatus(domain, customerId?)` — **v2** `GET /v2/customers/{customerId}/domains/{domain}/transfer`
- `validateTransferIn(domain, body, customerId?)` — **v2** `POST …/transfer/validate`
- `acceptTransferIn(domain, customerId?)` — **v2** `POST …/transferInAccept` **(M)**
- `cancelTransferIn(domain, customerId?)` — **v2** `POST …/transferInCancel` **(M)**
- `retryTransferIn(domain, body, customerId?)` — **v2** `POST …/transferInRetry` **(M)** — re-submit auth code
- `transferOutDomain(domain, customerId?)` — **v2** `POST …/transferOut` **(M)(!)**
- `acceptTransferOut(domain, customerId?)` — **v2** `POST …/transferOutAccept` **(M)(!)**
- `rejectTransferOut(domain, customerId?)` — **v2** `POST …/transferOutReject` **(M)**

### DNS Records — **v1** `/v1/domains/{domain}/records` (v2 has no general-record API)
- `getRecords(domain, type?, name?)` — `GET …/records[/{type}[/{name}]]`
- `addRecords(domain, records[])` — `PATCH …/records` **(M)**
- `replaceRecords(domain, records[])` — `PUT …/records` **(M)**
- `replaceRecordsByType(domain, type, records[], name?)` — `PUT …/records/{type}[/{name}]` **(M)**
- `deleteRecord(domain, type, name)` — `DELETE …/records/{type}/{name}` **(M)(!)**

### Certificates — **v1** `/v1/certificates`
- `createCertificate(body)` — `POST /v1/certificates` **(M)(!)**
- `getCertificate(certificateId)` — `GET /v1/certificates/{certificateId}`
- `listCertificates(params?)` — **v2** `GET /v2/certificates` (caller-scoped, no customerId — only v2 has a list)
- `getCertificateActions(certificateId)` — `GET /v1/certificates/{id}/actions`
- `downloadCertificate(certificateId)` — `GET /v1/certificates/{id}/download`
- `cancelCertificate(certificateId)` — `POST /v1/certificates/{id}/cancel` **(M)(!)**

### Orders — **v1** `/v1/orders` (no v2 API exists)
- `listOrders(params?)` — `GET /v1/orders`
- `getOrder(orderId)` — `GET /v1/orders/{orderId}`

Each SDK method has a corresponding CLI command (grouped: `domains/`, `dns/`,
`certificates/`, `orders/`) and MCP tool.

## CLI Conventions

Credential management uses `auth set godaddy [--key NAME] [--stdin] [--dry-run]`,
`auth list`, `auth delete godaddy [--key NAME] --yes [--dry-run]`, and
`auth migrate [--dry-run] [--overwrite]`. Set uses a hidden TTY prompt or explicit
stdin (multi-key stdin requires --key); values never enter argv or output.
List reports presence and active source. Migration copies active .env/config
credentials, skips existing entries unless overwritten, ignores process env,
and reports `clean_up` without editing files. Config show redacts credentials.
CLI API commands call async loadConfig for every operation.

Inherits the shared agent-native design:
- Non-interactive by default; `--yes`/`--force` for destructive ops.
- Output: `--toon` (default), `--json`, `--csv` via shared `outputFlags`/`formatOutput`.
- `--dry-run` on every mutation; `--idempotency-key` on purchase/create.
- Enumerated exit codes (network=1, validation=2, config=3, not-found=4, auth=5,
  rate-limit=6, dry-run=0) via shared `handle-error.ts`.
- `agent-context --json` introspection.

## MCP Conventions

Each tool call resolves credentials with async loadConfig so rotation applies
without restarting. `get_config_status` reports configured state, sources, and
keychain status without a GoDaddy request. MCP exposes no credential write/delete
tools. Recommended host configuration uses Bun source execution with no env block.

FastMCP stdio server. Tool groups registered per resource
(`registerDomainTools`, `registerDnsTools`, `registerCertificateTools`,
`registerOrderTools`). Tools return TOON-encoded strings by default; FastMCP
serializes thrown typed errors. Destructive tools carry clear descriptions and
non-readonly behavior annotations.

## Testing

SDK unit tests with mocked `fetch`:
- `resolveConfig`: required-var enforcement, `GODADDY_ENV`→baseUrl mapping,
  override precedence, optional shopper/customer id.
- `client`: auth header construction, error mapping per status, DNS record
  request shaping (PATCH/PUT/DELETE), unwrapped-response parsing.
- v1/v2 routing: v2 transfer methods build `/v2/customers/{customerId}/…` paths,
  resolve `customerId` from arg → `config.customerId`, and throw
  `GoDaddyValidationError` when neither is present; v1 methods stay on `/v1/…` and
  never reference customerId.

Gate: `bun test` and `bun run lint` (tsc --noEmit) green before each push.

## Git / Release Plan

1. Scaffold `godaddy-toolkit/` with `create-toolkit.ts`.
2. `git init`, initial commit of scaffold + this spec.
3. Create **public** repo `spenserhale/godaddy-ai-toolkit` via `gh repo create` and
   push `main` (skeleton).
4. Implement SDK → CLI → MCP per the surface above, pushing implementation commits
   as work proceeds.

## Out of Scope (v1)

- Domain v2 extras deferred: nameServers, dnssecRecords, privacy/forwarding,
  domain forwards, change-of-registrant, async actions polling, notifications.
- Certificate extras deferred: reissue, renew, revoke, email/callback management,
  v2 domainVerifications, ACME external account binding, certificate subscriptions.
- Abuse tickets, Aftermarket, Shoppers, Subscriptions APIs (future versions).
- Automatic customerId resolution from shopper id via the Shoppers API.
- Webhooks/event subscriptions; npm publishing / Changesets (later, per
  cloudflare-toolkit's pattern).
