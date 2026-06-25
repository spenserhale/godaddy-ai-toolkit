# GoDaddy Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ads:subagent-driven-development (recommended) or ads:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `godaddy-toolkit` — a typed SDK, agent-native CLI, and MCP server for the GoDaddy API (Domains, DNS, Certificates, Orders, plus full domain transfer in/out), and publish it to the public repo `spenserhale/godaddy-ai-toolkit`.

**Architecture:** Standard three-layer Bun monorepo (`packages/sdk` → `packages/cli` + `packages/mcp`). The SDK is the single source of truth: Zod types, a `GoDaddyClient` fetch wrapper with `sso-key` auth, `resolveConfig()`, and typed errors. CLI (Stricli) and MCP (FastMCP) are thin consumers. **Default to v1; use v2 only where v1 has no equivalent** (the domain transfer-management lifecycle and certificate list). `customerId` is an argument with `GODADDY_CUSTOMER_ID` fallback, needed only by v2 transfer calls.

**Tech Stack:** Bun, TypeScript (strict, ESM, `.js` import extensions), Zod, Stricli, FastMCP, `@toon-format/toon`, `gh` CLI.

**Reference spec:** `docs/ads/specs/2026-06-24-godaddy-toolkit-design.md`

---

## File Structure

```
godaddy-toolkit/
  packages/sdk/src/
    types.ts        Zod schemas + inferred types (config, domains, dns, certs, orders, transfers, errors)
    config.ts       resolveConfig() — env -> validated config (env->baseUrl map)
    errors.ts       GoDaddyError + Auth/NotFound/Validation/RateLimit subclasses
    client.ts       GoDaddyClient — sso-key auth, request<T>(), all API methods
    index.ts        public exports
    __tests__/      config.test.ts, client.test.ts
  packages/cli/src/
    output.ts       outputFlags + formatOutput (TOON default / json / csv)
    handle-error.ts resolveConfigOrExit + handleError (enumerated exit codes)
    commands/
      domains/      list, get, available, suggest, tlds, agreements, purchase, renew, update-contacts, cancel
      transfers/    in, status, validate, accept-in, cancel-in, retry-in, out, accept-out, reject-out
      dns/          get, add, replace, replace-type, delete
      certificates/ create, get, list, actions, download, cancel
      orders/       list, get
      agent-context.ts
    app.ts          Stricli route map
    bin.ts          entry (scaffold-generated)
  packages/mcp/src/
    index.ts        FastMCP server bootstrap
    tools/
      domains.ts        registerDomainTools
      transfers.ts      registerTransferTools
      dns.ts            registerDnsTools
      certificates.ts   registerCertificateTools
      orders.ts         registerOrderTools
      shared.ts         toonText() helper + shared zod fragments
  .env.example
  AGENTS.md
  README.md (scaffold-generated, lightly edited)
```

---

## Conventions used throughout

- **Class name:** `GoDaddyClient` (the scaffold generates `Godaddy*`; Task 1 renames everything to `GoDaddy*`).
- **Import extensions:** always `.js` even though source is `.ts`.
- **Response parsing:** response schemas use `.passthrough()` so GoDaddy's many extra fields don't break parsing; only fields we rely on are typed.
- **Commits:** one per task (or per sub-step where noted). Commit messages use Conventional Commits. **Do NOT add any `Co-Authored-By` trailer** (per user global instruction).
- **Run all commands from the `godaddy-toolkit/` root** unless stated.

---

## Task 0: Scaffold, git init, and push skeleton

**Files:**
- Create: entire `godaddy-toolkit/` tree (via scaffold) — except `docs/` which already exists (spec + this plan).

- [ ] **Step 1: Run the scaffold generator**

From `/Users/spenser/Code/Toolkits`:

```bash
bun run create-toolkit.ts godaddy -d "SDK, CLI, and MCP server for the GoDaddy API (domains, DNS, certificates, orders)"
```

Expected: prints `created ...` lines for `packages/sdk`, `packages/cli`, `packages/mcp`, root files. The existing `godaddy-toolkit/docs/` is untouched (scaffold only writes its own files).

- [ ] **Step 2: Install dependencies and confirm baseline builds**

```bash
cd godaddy-toolkit
bun install
bun run lint
```

Expected: `bun install` links the workspace; `bun run lint` passes (scaffold is type-clean).

- [ ] **Step 3: Add the toon dependency to the CLI package**

The scaffold's CLI `package.json` does not include TOON. Edit `packages/cli/package.json` dependencies to add:

```json
"@toon-format/toon": "^2.3.0"
```

Then re-run `bun install`. Expected: dependency resolves.

- [ ] **Step 4: git init and initial commit**

```bash
git init
git add -A
git commit -m "chore: scaffold godaddy-toolkit (sdk + cli + mcp) and add design spec/plan"
```

Expected: initial commit created on branch `main` (run `git branch -M main` if needed).

- [ ] **Step 5: Create the public GitHub repo and push**

```bash
gh repo create spenserhale/godaddy-ai-toolkit --public --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/spenserhale/godaddy-ai-toolkit`, `main` pushed. If `gh` is not authenticated, stop and ask the user to run `! gh auth login`.

> From here on, push after each task group (`git push`) so the public repo tracks progress.

---

## Task 1: SDK foundation — config, errors, base client (rename to `GoDaddy*`)

**Files:**
- Modify: `packages/sdk/src/types.ts` (replace config schema + error schema)
- Modify: `packages/sdk/src/config.ts` (rewrite)
- Modify: `packages/sdk/src/errors.ts` (rewrite)
- Modify: `packages/sdk/src/client.ts` (rewrite request layer; remove placeholder Resource methods)
- Test: `packages/sdk/__tests__/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `packages/sdk/__tests__/config.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { resolveConfig } from "../src/config.js";

const ENV_KEYS = ["GODADDY_API_KEY","GODADDY_API_SECRET","GODADDY_ENV","GODADDY_BASE_URL","GODADDY_SHOPPER_ID","GODADDY_CUSTOMER_ID"];

describe("resolveConfig", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; } });

  it("requires api key and secret", () => {
    expect(() => resolveConfig()).toThrow(/GODADDY_API_KEY/);
    expect(() => resolveConfig({ apiKey: "k" })).toThrow(/GODADDY_API_SECRET/);
  });

  it("defaults to prod base url", () => {
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.baseUrl).toBe("https://api.godaddy.com");
    expect(c.env).toBe("prod");
  });

  it("maps GODADDY_ENV=ote to the OTE base url", () => {
    process.env["GODADDY_ENV"] = "ote";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.baseUrl).toBe("https://api.ote-godaddy.com");
  });

  it("lets an explicit base url override env mapping", () => {
    process.env["GODADDY_ENV"] = "ote";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s", baseUrl: "https://example.test" });
    expect(c.baseUrl).toBe("https://example.test");
  });

  it("reads optional shopper and customer ids from env", () => {
    process.env["GODADDY_SHOPPER_ID"] = "123";
    process.env["GODADDY_CUSTOMER_ID"] = "uuid-1";
    const c = resolveConfig({ apiKey: "k", apiSecret: "s" });
    expect(c.shopperId).toBe("123");
    expect(c.customerId).toBe("uuid-1");
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
bun test packages/sdk/__tests__/config.test.ts
```

Expected: FAIL (config still has old YNAB-style shape / wrong exports).

- [ ] **Step 3: Replace the config schema and error schema in `types.ts`**

In `packages/sdk/src/types.ts`, replace the `GodaddyConfigSchema`/`ConfigSchema` block and the `ErrorResponseSchema` block with:

```ts
export const GoDaddyConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
  baseUrl: z.string().url().default("https://api.godaddy.com"),
  env: z.enum(["prod", "ote"]).default("prod"),
  shopperId: z.string().optional(),
  customerId: z.string().optional(),
});
export type GoDaddyConfig = z.infer<typeof GoDaddyConfigSchema>;

// GoDaddy error envelope: { code, message, fields?: [{ path, code, message, ... }] }
export const GoDaddyErrorFieldSchema = z.object({
  path: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

export const GoDaddyErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.array(GoDaddyErrorFieldSchema).optional(),
}).passthrough();
export type GoDaddyErrorResponse = z.infer<typeof GoDaddyErrorResponseSchema>;
```

Delete the placeholder `ResourceSchema`, `ListResourcesParamsSchema`, `CreateResourceParamsSchema`, `PaginatedResponseSchema` blocks (they are replaced by real domain types in later tasks).

- [ ] **Step 4: Rewrite `config.ts`**

Replace `packages/sdk/src/config.ts` with:

```ts
import type { GoDaddyConfig } from "./types.js";

const ENV_BASE_URLS: Record<"prod" | "ote", string> = {
  prod: "https://api.godaddy.com",
  ote: "https://api.ote-godaddy.com",
};

export function resolveConfig(overrides: Partial<GoDaddyConfig> = {}): GoDaddyConfig {
  const apiKey = overrides.apiKey ?? process.env["GODADDY_API_KEY"] ?? "";
  const apiSecret = overrides.apiSecret ?? process.env["GODADDY_API_SECRET"] ?? "";
  if (!apiKey) throw new Error("GODADDY_API_KEY is required");
  if (!apiSecret) throw new Error("GODADDY_API_SECRET is required");

  const env = (overrides.env ?? (process.env["GODADDY_ENV"] as "prod" | "ote" | undefined) ?? "prod");
  const baseUrl =
    overrides.baseUrl ??
    process.env["GODADDY_BASE_URL"] ??
    ENV_BASE_URLS[env] ??
    ENV_BASE_URLS.prod;

  return {
    apiKey,
    apiSecret,
    baseUrl,
    env: env === "ote" ? "ote" : "prod",
    shopperId: overrides.shopperId ?? process.env["GODADDY_SHOPPER_ID"],
    customerId: overrides.customerId ?? process.env["GODADDY_CUSTOMER_ID"],
  };
}
```

- [ ] **Step 5: Rewrite `errors.ts`**

Replace `packages/sdk/src/errors.ts` with:

```ts
export class GoDaddyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly fields?: unknown
  ) {
    super(message);
    this.name = "GoDaddyError";
  }
}

export class GoDaddyAuthError extends GoDaddyError {
  constructor(message = "Authentication failed. Check GODADDY_API_KEY and GODADDY_API_SECRET.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "GoDaddyAuthError";
  }
}

export class GoDaddyNotFoundError extends GoDaddyError {
  constructor(message = "Resource not found.") {
    super(message, "NOT_FOUND", 404);
    this.name = "GoDaddyNotFoundError";
  }
}

export class GoDaddyValidationError extends GoDaddyError {
  constructor(message = "Request validation failed.", fields?: unknown) {
    super(message, "VALIDATION_ERROR", 422, fields);
    this.name = "GoDaddyValidationError";
  }
}

export class GoDaddyRateLimitError extends GoDaddyError {
  constructor(
    message = "Rate limit exceeded. Retry after the indicated delay.",
    public readonly retryAfter?: number
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "GoDaddyRateLimitError";
  }
}
```

- [ ] **Step 6: Rewrite the client's request layer in `client.ts`**

Replace the entire contents of `packages/sdk/src/client.ts` with the base below (domain methods are added in later tasks; the markers show where):

```ts
import type { GoDaddyConfig } from "./types.js";
import { GoDaddyConfigSchema, GoDaddyErrorResponseSchema } from "./types.js";
import {
  GoDaddyError,
  GoDaddyAuthError,
  GoDaddyNotFoundError,
  GoDaddyValidationError,
  GoDaddyRateLimitError,
} from "./errors.js";

type QueryValue = string | number | boolean | string[] | undefined;

interface RequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
}

export class GoDaddyClient {
  private readonly config: GoDaddyConfig;

  constructor(config: Partial<GoDaddyConfig> & { apiKey: string; apiSecret: string }) {
    this.config = GoDaddyConfigSchema.parse(config);
  }

  private buildQuery(query?: Record<string, QueryValue>): string {
    if (!query) return "";
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

  private async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}${this.buildQuery(opts.query)}`;
    const headers: Record<string, string> = {
      Authorization: `sso-key ${this.config.apiKey}:${this.config.apiSecret}`,
      Accept: "application/json",
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (this.config.shopperId) headers["X-Shopper-Id"] = this.config.shopperId;

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) await this.throwForResponse(res);

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private async throwForResponse(res: Response): Promise<never> {
    const raw = await res.json().catch(() => null);
    const parsed = GoDaddyErrorResponseSchema.safeParse(raw);
    const message = parsed.success ? parsed.data.message : `HTTP ${res.status}`;
    const code = parsed.success ? parsed.data.code : "UNKNOWN";
    const fields = parsed.success ? parsed.data.fields : undefined;

    if (res.status === 401 || res.status === 403) throw new GoDaddyAuthError(message);
    if (res.status === 404) throw new GoDaddyNotFoundError(message);
    if (res.status === 422) throw new GoDaddyValidationError(message, fields);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
      throw new GoDaddyRateLimitError(message, retryAfter);
    }
    throw new GoDaddyError(message, code, res.status, fields);
  }

  /** Resolve the customerId for a v2 customer-scoped call: arg -> config -> throw. */
  private requireCustomerId(customerId?: string): string {
    const id = customerId ?? this.config.customerId;
    if (!id) {
      throw new GoDaddyValidationError(
        "customerId is required for this v2 operation. Pass it as an argument or set GODADDY_CUSTOMER_ID."
      );
    }
    return id;
  }

  // === DOMAINS (Task 2, 3) ===
  // === TRANSFERS (Task 4) ===
  // === DNS RECORDS (Task 5) ===
  // === CERTIFICATES (Task 6) ===
  // === ORDERS (Task 7) ===
}
```

- [ ] **Step 7: Make `index.ts` compile (temporary minimal exports)**

Replace `packages/sdk/src/index.ts` with:

```ts
export { GoDaddyClient } from "./client.js";
export { resolveConfig } from "./config.js";
export {
  GoDaddyError,
  GoDaddyAuthError,
  GoDaddyNotFoundError,
  GoDaddyValidationError,
  GoDaddyRateLimitError,
} from "./errors.js";
export type { GoDaddyConfig, GoDaddyErrorResponse } from "./types.js";
export { GoDaddyConfigSchema, GoDaddyErrorResponseSchema } from "./types.js";
```

Delete the scaffold's `packages/sdk/__tests__/*` placeholder test that references `Resource`/`createResource` if present (or overwrite it in later tasks). Check with `ls packages/sdk/__tests__`.

- [ ] **Step 8: Run config tests + lint — expect pass**

```bash
bun test packages/sdk/__tests__/config.test.ts
bun run --filter '@godaddy-toolkit/sdk' lint
```

Expected: config tests PASS; lint clean.

- [ ] **Step 9: Commit**

```bash
git add packages/sdk
git commit -m "feat(sdk): config, typed errors, and sso-key request layer"
```

---

## Task 2: SDK — Domain read operations

**Files:**
- Modify: `packages/sdk/src/types.ts` (add domain schemas)
- Modify: `packages/sdk/src/client.ts` (add read methods under `=== DOMAINS ===`)
- Test: `packages/sdk/__tests__/client.test.ts`

- [ ] **Step 1: Add domain types to `types.ts`**

Append:

```ts
// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export const DomainSummarySchema = z.object({
  domainId: z.number().optional(),
  domain: z.string(),
  status: z.string().optional(),
  expires: z.string().optional(),
  createdAt: z.string().optional(),
  renewable: z.boolean().optional(),
  renewAuto: z.boolean().optional(),
}).passthrough();
export type DomainSummary = z.infer<typeof DomainSummarySchema>;

export const DomainDetailSchema = DomainSummarySchema.extend({
  nameServers: z.array(z.string()).optional(),
  contactAdmin: z.unknown().optional(),
  contactRegistrant: z.unknown().optional(),
}).passthrough();
export type DomainDetail = z.infer<typeof DomainDetailSchema>;

export const DomainAvailableSchema = z.object({
  domain: z.string(),
  available: z.boolean(),
  price: z.number().optional(),
  currency: z.string().optional(),
  period: z.number().optional(),
  definitive: z.boolean().optional(),
}).passthrough();
export type DomainAvailable = z.infer<typeof DomainAvailableSchema>;

export const DomainSuggestionSchema = z.object({ domain: z.string() }).passthrough();
export type DomainSuggestion = z.infer<typeof DomainSuggestionSchema>;

export const TldSummarySchema = z.object({ name: z.string(), type: z.string().optional() }).passthrough();
export type TldSummary = z.infer<typeof TldSummarySchema>;

export const LegalAgreementSchema = z.object({
  agreementKey: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string().optional(),
}).passthrough();
export type LegalAgreement = z.infer<typeof LegalAgreementSchema>;
```

- [ ] **Step 2: Write failing client tests for domain reads**

Create `packages/sdk/__tests__/client.test.ts`:

```ts
import { describe, expect, it, mock, afterEach } from "bun:test";
import { GoDaddyClient } from "../src/client.js";
import { GoDaddyAuthError, GoDaddyValidationError } from "../src/errors.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown; headers?: Record<string,string> }) {
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const { status = 200, body = "", headers = {} } = handler(String(url), init ?? {});
    const payload = body === "" ? "" : JSON.stringify(body);
    return new Response(payload, { status, headers: { "Content-Type": "application/json", ...headers } });
  }) as unknown as typeof fetch;
}

const client = () => new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test" });

describe("GoDaddyClient domains (read)", () => {
  it("sends sso-key auth header and lists domains", async () => {
    let seenAuth = "";
    stubFetch((url, init) => { seenAuth = (init.headers as Record<string,string>).Authorization; return { body: [{ domain: "a.com", status: "ACTIVE" }] }; });
    const out = await client().listDomains();
    expect(seenAuth).toBe("sso-key k:s");
    expect(out[0]!.domain).toBe("a.com");
  });

  it("maps 401 to GoDaddyAuthError", async () => {
    stubFetch(() => ({ status: 401, body: { code: "UNAUTHORIZED", message: "bad key" } }));
    await expect(client().listDomains()).rejects.toBeInstanceOf(GoDaddyAuthError);
  });

  it("checks availability via query param", async () => {
    let seenUrl = "";
    stubFetch((url) => { seenUrl = url; return { body: { domain: "x.com", available: true } }; });
    const r = await client().checkAvailability("x.com");
    expect(seenUrl).toContain("/v1/domains/available?domain=x.com");
    expect(r.available).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
bun test packages/sdk/__tests__/client.test.ts
```

Expected: FAIL (`listDomains` not a function).

- [ ] **Step 4: Implement domain read methods in `client.ts`**

Add imports at top of `client.ts` (extend the existing `types.js` import):

```ts
import {
  GoDaddyConfigSchema, GoDaddyErrorResponseSchema,
  DomainSummarySchema, DomainDetailSchema, DomainAvailableSchema,
  DomainSuggestionSchema, TldSummarySchema, LegalAgreementSchema,
} from "./types.js";
import type {
  GoDaddyConfig, DomainSummary, DomainDetail, DomainAvailable,
  DomainSuggestion, TldSummary, LegalAgreement,
} from "./types.js";
```

Under `// === DOMAINS ===` add:

```ts
/** v1 GET /v1/domains */
async listDomains(params?: { statuses?: string[]; limit?: number; marker?: string; includes?: string[] }): Promise<DomainSummary[]> {
  const data = await this.request<unknown[]>("GET", "/v1/domains", { query: {
    statuses: params?.statuses, limit: params?.limit, marker: params?.marker, includes: params?.includes,
  }});
  return DomainSummarySchema.array().parse(data);
}

/** v1 GET /v1/domains/{domain} */
async getDomain(domain: string): Promise<DomainDetail> {
  const data = await this.request<unknown>("GET", `/v1/domains/${encodeURIComponent(domain)}`);
  return DomainDetailSchema.parse(data);
}

/** v1 GET /v1/domains/available */
async checkAvailability(domain: string, opts?: { checkType?: "FAST" | "FULL"; forTransfer?: boolean }): Promise<DomainAvailable> {
  const data = await this.request<unknown>("GET", "/v1/domains/available", { query: {
    domain, checkType: opts?.checkType, forTransfer: opts?.forTransfer,
  }});
  return DomainAvailableSchema.parse(data);
}

/** v1 POST /v1/domains/available (bulk) */
async checkAvailabilityBulk(domains: string[], opts?: { checkType?: "FAST" | "FULL" }): Promise<{ domains: DomainAvailable[]; errors?: unknown[] }> {
  const data = await this.request<{ domains: unknown[]; errors?: unknown[] }>("POST", "/v1/domains/available", {
    body: domains, query: { checkType: opts?.checkType },
  });
  return { domains: DomainAvailableSchema.array().parse(data.domains ?? []), errors: data.errors };
}

/** v1 GET /v1/domains/suggest */
async suggestDomains(query: string, opts?: { tlds?: string[]; limit?: number }): Promise<DomainSuggestion[]> {
  const data = await this.request<unknown[]>("GET", "/v1/domains/suggest", { query: {
    query, tlds: opts?.tlds, limit: opts?.limit,
  }});
  return DomainSuggestionSchema.array().parse(data);
}

/** v1 GET /v1/domains/tlds */
async listTlds(): Promise<TldSummary[]> {
  const data = await this.request<unknown[]>("GET", "/v1/domains/tlds");
  return TldSummarySchema.array().parse(data);
}

/** v1 GET /v1/domains/agreements */
async getAgreements(tlds: string[], opts?: { privacy?: boolean; forTransfer?: boolean }): Promise<LegalAgreement[]> {
  const data = await this.request<unknown[]>("GET", "/v1/domains/agreements", { query: {
    tlds, privacy: opts?.privacy, forTransfer: opts?.forTransfer,
  }});
  return LegalAgreementSchema.array().parse(data);
}
```

- [ ] **Step 5: Run tests + lint — expect pass**

```bash
bun test packages/sdk/__tests__/client.test.ts
bun run --filter '@godaddy-toolkit/sdk' lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk
git commit -m "feat(sdk): domain read operations (list, get, available, suggest, tlds, agreements)"
```

---

## Task 3: SDK — Domain mutations (purchase, renew, contacts, cancel)

**Files:**
- Modify: `packages/sdk/src/types.ts` (add purchase/contact schemas)
- Modify: `packages/sdk/src/client.ts`
- Test: `packages/sdk/__tests__/client.test.ts` (add cases)

- [ ] **Step 1: Add types**

Append to `types.ts`:

```ts
export const DomainContactSchema = z.object({
  nameFirst: z.string(),
  nameLast: z.string(),
  email: z.string(),
  phone: z.string(),
  addressMailing: z.object({
    address1: z.string(), city: z.string(), state: z.string().optional(),
    postalCode: z.string(), country: z.string(),
  }).passthrough(),
  organization: z.string().optional(),
}).passthrough();
export type DomainContact = z.infer<typeof DomainContactSchema>;

// Purchase/renew bodies are passed through to GoDaddy as-is (schema varies by TLD).
export const DomainPurchaseSchema = z.record(z.unknown());
export type DomainPurchase = z.infer<typeof DomainPurchaseSchema>;

export const DomainPurchaseResultSchema = z.object({
  orderId: z.number().optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
  itemCount: z.number().optional(),
}).passthrough();
export type DomainPurchaseResult = z.infer<typeof DomainPurchaseResultSchema>;
```

- [ ] **Step 2: Write failing tests (renew + cancel)**

Add to `client.test.ts` inside a new describe:

```ts
describe("GoDaddyClient domains (mutations)", () => {
  it("renews a domain with POST body", async () => {
    let seen = { url: "", method: "", body: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string, body: init.body as string }; return { body: { orderId: 1 } }; });
    await client().renewDomain("a.com", { period: 1 });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/domains/a.com/renew");
    expect(JSON.parse(seen.body).period).toBe(1);
  });

  it("cancels a domain with DELETE", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { status: 204 }; });
    await client().cancelDomain("a.com");
    expect(seen.method).toBe("DELETE");
    expect(seen.url).toContain("/v1/domains/a.com");
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
bun test packages/sdk/__tests__/client.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement mutation methods in `client.ts`**

Add `DomainContact`, `DomainPurchase`, `DomainPurchaseResult` to the type/schema imports, then under `// === DOMAINS ===`:

```ts
/** v1 POST /v1/domains/purchase — billable */
async purchaseDomain(body: DomainPurchase): Promise<DomainPurchaseResult> {
  const data = await this.request<unknown>("POST", "/v1/domains/purchase", { body });
  return DomainPurchaseResultSchema.parse(data);
}

/** v1 PATCH /v1/domains/{domain}/contacts */
async updateDomainContacts(domain: string, contacts: Record<string, DomainContact>): Promise<void> {
  await this.request<void>("PATCH", `/v1/domains/${encodeURIComponent(domain)}/contacts`, { body: contacts });
}

/** v1 POST /v1/domains/{domain}/renew — billable */
async renewDomain(domain: string, body?: { period?: number }): Promise<DomainPurchaseResult> {
  const data = await this.request<unknown>("POST", `/v1/domains/${encodeURIComponent(domain)}/renew`, { body: body ?? {} });
  return DomainPurchaseResultSchema.parse(data ?? {});
}

/** v1 DELETE /v1/domains/{domain} — cancels/deletes the domain */
async cancelDomain(domain: string): Promise<void> {
  await this.request<void>("DELETE", `/v1/domains/${encodeURIComponent(domain)}`);
}
```

- [ ] **Step 5: Run tests + lint — expect pass; Step 6: Commit**

```bash
bun test packages/sdk/__tests__/client.test.ts && bun run --filter '@godaddy-toolkit/sdk' lint
git add packages/sdk && git commit -m "feat(sdk): domain mutations (purchase, renew, update-contacts, cancel)"
```

---

## Task 4: SDK — Domain transfers (v1 initiate + v2 lifecycle)

**Files:**
- Modify: `packages/sdk/src/types.ts` (transfer schemas)
- Modify: `packages/sdk/src/client.ts`
- Test: `packages/sdk/__tests__/client.test.ts` (add cases incl. customerId enforcement)

- [ ] **Step 1: Add types**

```ts
export const TransferStatusSchema = z.object({
  domain: z.string().optional(),
  status: z.string().optional(),
  registrar: z.string().optional(),
}).passthrough();
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const TransferInBodySchema = z.record(z.unknown()); // purchase + authCode + contacts; varies by TLD
export type TransferInBody = z.infer<typeof TransferInBodySchema>;
```

- [ ] **Step 2: Write failing tests (v2 path + customerId fallback + missing-customerId throw)**

```ts
describe("GoDaddyClient transfers", () => {
  it("initiates transfer-in via v1 (no customerId needed)", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { body: { orderId: 9 } }; });
    await client().transferInDomain("a.com", { authCode: "x" });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/domains/a.com/transfer");
  });

  it("queries transfer status via v2 with customerId from config", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { status: "PENDING" } }; });
    const c = new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test", customerId: "cust-1" });
    await c.getTransferStatus("a.com");
    expect(seen).toContain("/v2/customers/cust-1/domains/a.com/transfer");
  });

  it("prefers an explicit customerId argument over config", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: {} }; });
    const c = new GoDaddyClient({ apiKey: "k", apiSecret: "s", baseUrl: "https://api.example.test", customerId: "cfg" });
    await c.acceptTransferIn("a.com", "arg-cust");
    expect(seen).toContain("/v2/customers/arg-cust/domains/a.com/transferInAccept");
  });

  it("throws GoDaddyValidationError when no customerId is available", async () => {
    stubFetch(() => ({ body: {} }));
    await expect(client().transferOutDomain("a.com")).rejects.toBeInstanceOf(GoDaddyValidationError);
  });
});
```

- [ ] **Step 3: Run — expect failure.** `bun test packages/sdk/__tests__/client.test.ts`

- [ ] **Step 4: Implement transfer methods**

Add `TransferStatus`/`TransferInBody` to imports. Under `// === TRANSFERS ===`:

```ts
/** v1 POST /v1/domains/{domain}/transfer — purchase & start/restart a transfer-in (billable) */
async transferInDomain(domain: string, body: TransferInBody): Promise<DomainPurchaseResult> {
  const data = await this.request<unknown>("POST", `/v1/domains/${encodeURIComponent(domain)}/transfer`, { body });
  return DomainPurchaseResultSchema.parse(data ?? {});
}

private v2DomainPath(domain: string, suffix: string, customerId?: string): string {
  const cust = this.requireCustomerId(customerId);
  return `/v2/customers/${encodeURIComponent(cust)}/domains/${encodeURIComponent(domain)}${suffix}`;
}

/** v2 GET …/transfer */
async getTransferStatus(domain: string, customerId?: string): Promise<TransferStatus> {
  const data = await this.request<unknown>("GET", this.v2DomainPath(domain, "/transfer", customerId));
  return TransferStatusSchema.parse(data ?? {});
}

/** v2 POST …/transfer/validate */
async validateTransferIn(domain: string, body: TransferInBody, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transfer/validate", customerId), { body });
}

/** v2 POST …/transferInAccept */
async acceptTransferIn(domain: string, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferInAccept", customerId), { body: {} });
}

/** v2 POST …/transferInCancel */
async cancelTransferIn(domain: string, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferInCancel", customerId), { body: {} });
}

/** v2 POST …/transferInRetry — resubmit auth code */
async retryTransferIn(domain: string, body: { authCode: string }, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferInRetry", customerId), { body });
}

/** v2 POST …/transferOut (billable / ownership change) */
async transferOutDomain(domain: string, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferOut", customerId), { body: {} });
}

/** v2 POST …/transferOutAccept */
async acceptTransferOut(domain: string, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferOutAccept", customerId), { body: {} });
}

/** v2 POST …/transferOutReject */
async rejectTransferOut(domain: string, customerId?: string): Promise<void> {
  await this.request<void>("POST", this.v2DomainPath(domain, "/transferOutReject", customerId), { body: {} });
}
```

- [ ] **Step 5: Run tests + lint — expect pass; Step 6: Commit**

```bash
bun test packages/sdk/__tests__/client.test.ts && bun run --filter '@godaddy-toolkit/sdk' lint
git add packages/sdk && git commit -m "feat(sdk): domain transfers in/out (v1 initiate + v2 lifecycle)"
```

---

## Task 5: SDK — DNS records (v1)

**Files:** `types.ts`, `client.ts`, `client.test.ts`

- [ ] **Step 1: Add DNS types**

```ts
export const DnsRecordTypeSchema = z.enum(["A","AAAA","CNAME","MX","NS","SOA","SRV","TXT","CAA"]);
export type DnsRecordType = z.infer<typeof DnsRecordTypeSchema>;

export const DnsRecordSchema = z.object({
  type: DnsRecordTypeSchema,
  name: z.string(),
  data: z.string(),
  ttl: z.number().int().optional(),
  priority: z.number().int().optional(),
  service: z.string().optional(),
  protocol: z.string().optional(),
  port: z.number().int().optional(),
  weight: z.number().int().optional(),
}).passthrough();
export type DnsRecord = z.infer<typeof DnsRecordSchema>;
```

- [ ] **Step 2: Write failing tests**

```ts
describe("GoDaddyClient dns records", () => {
  it("gets records filtered by type and name", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: [{ type: "A", name: "@", data: "1.2.3.4" }] }; });
    const r = await client().getRecords("a.com", "A", "@");
    expect(seen).toContain("/v1/domains/a.com/records/A/%40");
    expect(r[0]!.data).toBe("1.2.3.4");
  });

  it("adds records with PATCH", async () => {
    let method = "";
    stubFetch((_url, init) => { method = init.method as string; return { status: 200 }; });
    await client().addRecords("a.com", [{ type: "TXT", name: "@", data: "hello" }]);
    expect(method).toBe("PATCH");
  });

  it("deletes a record with DELETE", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { status: 204 }; });
    await client().deleteRecord("a.com", "A", "old");
    expect(seen.method).toBe("DELETE");
    expect(seen.url).toContain("/v1/domains/a.com/records/A/old");
  });
});
```

- [ ] **Step 3: Run — expect failure.**

- [ ] **Step 4: Implement DNS methods**

Add `DnsRecord`, `DnsRecordType`, `DnsRecordSchema` to imports. Under `// === DNS RECORDS ===`:

```ts
private recordsPath(domain: string, type?: string, name?: string): string {
  let p = `/v1/domains/${encodeURIComponent(domain)}/records`;
  if (type) p += `/${encodeURIComponent(type)}`;
  if (type && name) p += `/${encodeURIComponent(name)}`;
  return p;
}

/** v1 GET …/records[/{type}[/{name}]] */
async getRecords(domain: string, type?: DnsRecordType, name?: string): Promise<DnsRecord[]> {
  const data = await this.request<unknown[]>("GET", this.recordsPath(domain, type, name));
  return DnsRecordSchema.array().parse(data);
}

/** v1 PATCH …/records — append records */
async addRecords(domain: string, records: DnsRecord[]): Promise<void> {
  await this.request<void>("PATCH", this.recordsPath(domain), { body: records });
}

/** v1 PUT …/records — replace ALL records */
async replaceRecords(domain: string, records: DnsRecord[]): Promise<void> {
  await this.request<void>("PUT", this.recordsPath(domain), { body: records });
}

/** v1 PUT …/records/{type}[/{name}] — replace records of a type (optionally a name) */
async replaceRecordsByType(domain: string, type: DnsRecordType, records: DnsRecord[], name?: string): Promise<void> {
  await this.request<void>("PUT", this.recordsPath(domain, type, name), { body: records });
}

/** v1 DELETE …/records/{type}/{name} */
async deleteRecord(domain: string, type: DnsRecordType, name: string): Promise<void> {
  await this.request<void>("DELETE", this.recordsPath(domain, type, name));
}
```

- [ ] **Step 5: Run tests + lint; Step 6: Commit**

```bash
bun test packages/sdk/__tests__/client.test.ts && bun run --filter '@godaddy-toolkit/sdk' lint
git add packages/sdk && git commit -m "feat(sdk): DNS record management (get/add/replace/delete)"
```

---

## Task 6: SDK — Certificates

**Files:** `types.ts`, `client.ts`, `client.test.ts`

- [ ] **Step 1: Add certificate types**

```ts
export const CertificateSchema = z.object({
  certificateId: z.string().optional(),
  status: z.string().optional(),
  commonName: z.string().optional(),
  period: z.number().optional(),
  type: z.string().optional(),
}).passthrough();
export type Certificate = z.infer<typeof CertificateSchema>;

export const CertificateCreateSchema = z.record(z.unknown()); // CSR + product details
export type CertificateCreate = z.infer<typeof CertificateCreateSchema>;

export const CertificateActionSchema = z.object({
  createdAt: z.string().optional(),
  type: z.string().optional(),
}).passthrough();
export type CertificateAction = z.infer<typeof CertificateActionSchema>;
```

- [ ] **Step 2: Write failing tests**

```ts
describe("GoDaddyClient certificates", () => {
  it("creates a certificate via v1", async () => {
    let seen = { url: "", method: "" };
    stubFetch((url, init) => { seen = { url, method: init.method as string }; return { body: { certificateId: "c1" } }; });
    await client().createCertificate({ commonName: "a.com" });
    expect(seen.method).toBe("POST");
    expect(seen.url).toContain("/v1/certificates");
  });

  it("lists certificates via v2 (no customerId)", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { certificates: [{ certificateId: "c1" }] } }; });
    const r = await client().listCertificates();
    expect(seen).toContain("/v2/certificates");
    expect(r[0]!.certificateId).toBe("c1");
  });
});
```

- [ ] **Step 3: Run — expect failure.**

- [ ] **Step 4: Implement certificate methods**

Add cert types to imports. Under `// === CERTIFICATES ===`:

```ts
/** v1 POST /v1/certificates — billable */
async createCertificate(body: CertificateCreate): Promise<Certificate> {
  const data = await this.request<unknown>("POST", "/v1/certificates", { body });
  return CertificateSchema.parse(data ?? {});
}

/** v1 GET /v1/certificates/{certificateId} */
async getCertificate(certificateId: string): Promise<Certificate> {
  const data = await this.request<unknown>("GET", `/v1/certificates/${encodeURIComponent(certificateId)}`);
  return CertificateSchema.parse(data);
}

/** v2 GET /v2/certificates — caller-scoped list (only v2 offers a list) */
async listCertificates(params?: { limit?: number; offset?: number }): Promise<Certificate[]> {
  const data = await this.request<{ certificates?: unknown[] }>("GET", "/v2/certificates", { query: {
    limit: params?.limit, offset: params?.offset,
  }});
  return CertificateSchema.array().parse(data.certificates ?? []);
}

/** v1 GET /v1/certificates/{id}/actions */
async getCertificateActions(certificateId: string): Promise<CertificateAction[]> {
  const data = await this.request<unknown[]>("GET", `/v1/certificates/${encodeURIComponent(certificateId)}/actions`);
  return CertificateActionSchema.array().parse(data);
}

/** v1 GET /v1/certificates/{id}/download */
async downloadCertificate(certificateId: string): Promise<unknown> {
  return this.request<unknown>("GET", `/v1/certificates/${encodeURIComponent(certificateId)}/download`);
}

/** v1 POST /v1/certificates/{id}/cancel */
async cancelCertificate(certificateId: string): Promise<void> {
  await this.request<void>("POST", `/v1/certificates/${encodeURIComponent(certificateId)}/cancel`, { body: {} });
}
```

- [ ] **Step 5: Run tests + lint; Step 6: Commit**

```bash
bun test packages/sdk/__tests__/client.test.ts && bun run --filter '@godaddy-toolkit/sdk' lint
git add packages/sdk && git commit -m "feat(sdk): certificates (create, get, list, actions, download, cancel)"
```

---

## Task 7: SDK — Orders + finalize exports

**Files:** `types.ts`, `client.ts`, `index.ts`, `client.test.ts`

- [ ] **Step 1: Add order types**

```ts
export const OrderSchema = z.object({
  orderId: z.number().optional(),
  createdAt: z.string().optional(),
  currency: z.string().optional(),
  total: z.number().optional(),
}).passthrough();
export type Order = z.infer<typeof OrderSchema>;
```

- [ ] **Step 2: Write failing test**

```ts
describe("GoDaddyClient orders", () => {
  it("lists orders", async () => {
    let seen = "";
    stubFetch((url) => { seen = url; return { body: { orders: [{ orderId: 1 }] } }; });
    const r = await client().listOrders();
    expect(seen).toContain("/v1/orders");
    expect(r[0]!.orderId).toBe(1);
  });
});
```

- [ ] **Step 3: Run — expect failure.**

- [ ] **Step 4: Implement order methods.** Under `// === ORDERS ===`:

```ts
/** v1 GET /v1/orders */
async listOrders(params?: { limit?: number; offset?: number; periodStart?: string; periodEnd?: string }): Promise<Order[]> {
  const data = await this.request<{ orders?: unknown[] }>("GET", "/v1/orders", { query: {
    limit: params?.limit, offset: params?.offset, periodStart: params?.periodStart, periodEnd: params?.periodEnd,
  }});
  return OrderSchema.array().parse(data.orders ?? []);
}

/** v1 GET /v1/orders/{orderId} */
async getOrder(orderId: string): Promise<Order> {
  const data = await this.request<unknown>("GET", `/v1/orders/${encodeURIComponent(orderId)}`);
  return OrderSchema.parse(data);
}
```

- [ ] **Step 5: Finalize `index.ts`** — export every type/schema. Replace `index.ts` with:

```ts
export { GoDaddyClient } from "./client.js";
export { resolveConfig } from "./config.js";
export {
  GoDaddyError, GoDaddyAuthError, GoDaddyNotFoundError, GoDaddyValidationError, GoDaddyRateLimitError,
} from "./errors.js";
export type {
  GoDaddyConfig, GoDaddyErrorResponse,
  DomainSummary, DomainDetail, DomainAvailable, DomainSuggestion, TldSummary, LegalAgreement,
  DomainContact, DomainPurchase, DomainPurchaseResult,
  TransferStatus, TransferInBody,
  DnsRecord, DnsRecordType,
  Certificate, CertificateCreate, CertificateAction,
  Order,
} from "./types.js";
export {
  GoDaddyConfigSchema, GoDaddyErrorResponseSchema,
  DomainSummarySchema, DomainDetailSchema, DomainAvailableSchema, DomainSuggestionSchema, TldSummarySchema, LegalAgreementSchema,
  DomainContactSchema, DomainPurchaseSchema, DomainPurchaseResultSchema,
  TransferStatusSchema, TransferInBodySchema,
  DnsRecordSchema, DnsRecordTypeSchema,
  CertificateSchema, CertificateCreateSchema, CertificateActionSchema,
  OrderSchema,
} from "./types.js";
```

- [ ] **Step 6: Run full SDK suite + lint**

```bash
bun test packages/sdk
bun run --filter '@godaddy-toolkit/sdk' lint
```

Expected: all SDK tests PASS, lint clean.

- [ ] **Step 7: Commit + push**

```bash
git add packages/sdk && git commit -m "feat(sdk): orders + finalize public exports"
git push
```

---

## Task 8: CLI — shared infrastructure (output + error handling)

**Files:**
- Create: `packages/cli/src/output.ts`
- Create: `packages/cli/src/handle-error.ts`

- [ ] **Step 1: Create `output.ts`** — copy the shared utility verbatim:

```ts
import { encode } from "@toon-format/toon";

export const outputFlags = {
  toon: { kind: "boolean" as const, brief: "Output as TOON (default)", default: false },
  json: { kind: "boolean" as const, brief: "Output as JSON", default: false },
  csv:  { kind: "boolean" as const, brief: "Output as CSV (list commands only)", default: false },
};

export interface OutputFlags {
  readonly toon: boolean;
  readonly json: boolean;
  readonly csv: boolean;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

export function formatOutput(data: unknown, flags: OutputFlags): string {
  if (flags.json) return JSON.stringify(data, null, 2);
  if (flags.csv) {
    let csvData: unknown = data;
    if (!Array.isArray(data) && typeof data === "object" && data !== null) {
      const arr = Object.values(data as Record<string, unknown>).find(Array.isArray);
      if (arr !== undefined) csvData = arr;
    }
    if (!Array.isArray(csvData)) {
      console.error("error: --csv requires a list command. Use --toon (default) or --json.");
      process.exit(2);
    }
    return toCsv(csvData as Record<string, unknown>[]);
  }
  return encode(data);
}
```

- [ ] **Step 2: Create `handle-error.ts`:**

```ts
import {
  GoDaddyAuthError, GoDaddyNotFoundError, GoDaddyValidationError, GoDaddyRateLimitError, GoDaddyError,
  resolveConfig,
} from "@godaddy-toolkit/sdk";
import type { GoDaddyConfig } from "@godaddy-toolkit/sdk";

export function resolveConfigOrExit(): GoDaddyConfig {
  try {
    return resolveConfig();
  } catch (err) {
    console.error(`Config error: ${err instanceof Error ? err.message : String(err)}. Set GODADDY_API_KEY and GODADDY_API_SECRET in your .env file.`);
    process.exit(3);
  }
}

export function handleError(err: unknown): never {
  if (err instanceof GoDaddyAuthError) { console.error(`Auth error: ${err.message}`); process.exit(5); }
  if (err instanceof GoDaddyNotFoundError) { console.error(`Not found: ${err.message}`); process.exit(4); }
  if (err instanceof GoDaddyRateLimitError) { console.error(`Rate limit exceeded: ${err.message}`); process.exit(6); }
  if (err instanceof GoDaddyValidationError) { console.error(`Validation error: ${err.message}`); process.exit(2); }
  if (err instanceof GoDaddyError) { console.error(`API error: ${err.message}`); process.exit(1); }
  if (err instanceof Error && err.name === "ZodError") { console.error(`Validation error: ${err.message}`); process.exit(2); }
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
```

- [ ] **Step 3: Lint + commit**

```bash
bun run --filter '@godaddy-toolkit/cli' lint
git add packages/cli && git commit -m "feat(cli): shared output formatting and error handling"
```

---

## Task 9: CLI — command files (all groups)

Each command file follows one of three templates. **Read the exemplars, then create every file in the spec table** with the exact name, flags, positionals, and SDK call given.

**Files:** Create one file per command listed in the tables below under `packages/cli/src/commands/<group>/<name>.ts`. Delete the scaffold's placeholder `packages/cli/src/commands/*` (the old `resource` commands) before starting: `rm -rf packages/cli/src/commands` then recreate.

- [ ] **Step 1: Exemplar A — list command (`commands/domains/list.ts`)**

```ts
import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface ListDomainsFlags extends OutputFlags {
  readonly status?: string;
  readonly limit?: number;
}

export const listDomainsCommand = buildCommand({
  docs: { brief: "List domains in the account" },
  parameters: {
    flags: {
      status: { kind: "parsed", parse: String, brief: "Filter by status (e.g. ACTIVE)", optional: true },
      limit: { kind: "parsed", parse: Number, brief: "Max results", optional: true },
      ...outputFlags,
    },
  },
  async func(this: void, flags: ListDomainsFlags) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      const result = await client.listDomains({
        statuses: flags.status ? [flags.status] : undefined,
        limit: flags.limit,
      });
      console.log(formatOutput(result, flags));
    } catch (err) { handleError(err); }
  },
});
```

- [ ] **Step 2: Exemplar B — single-positional get command (`commands/domains/get.ts`)**

```ts
import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const getDomainCommand = buildCommand({
  docs: { brief: "Get a domain by name" },
  parameters: {
    flags: { ...outputFlags },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: OutputFlags, domain: string) {
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      console.log(formatOutput(await client.getDomain(domain), flags));
    } catch (err) { handleError(err); }
  },
});
```

- [ ] **Step 3: Exemplar C — guarded mutation command (`commands/domains/cancel.ts`)**

```ts
import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface CancelDomainFlags {
  readonly yes: boolean;
  readonly "dry-run": boolean;
}

export const cancelDomainCommand = buildCommand({
  docs: { brief: "Cancel (delete) a domain — irreversible" },
  parameters: {
    flags: {
      yes: { kind: "boolean", brief: "Confirm the destructive action", default: false },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: CancelDomainFlags, domain: string) {
    if (flags["dry-run"]) { console.log(`[dry-run] would cancel domain ${domain}`); return; }
    if (!flags.yes) { console.error("Refusing to cancel without --yes. Re-run with --yes to confirm."); process.exit(2); }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.cancelDomain(domain);
      console.log(`Canceled ${domain}`);
    } catch (err) { handleError(err); }
  },
});
```

For mutations that take a JSON body (purchase, transfer-in, create-certificate, DNS writes), use this body-flag pattern (shown for `commands/dns/add.ts`):

```ts
import { buildCommand } from "@stricli/core";
import { GoDaddyClient } from "@godaddy-toolkit/sdk";
import type { DnsRecord } from "@godaddy-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";

interface AddRecordsFlags { readonly records: string; readonly "dry-run": boolean; }

export const addRecordsCommand = buildCommand({
  docs: { brief: "Append DNS records to a domain" },
  parameters: {
    flags: {
      records: { kind: "parsed", parse: String, brief: "JSON array of records, e.g. '[{\"type\":\"A\",\"name\":\"@\",\"data\":\"1.2.3.4\"}]'" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
    },
    positional: { kind: "tuple", parameters: [{ brief: "Domain name", parse: String }] },
  },
  async func(this: void, flags: AddRecordsFlags, domain: string) {
    const records = JSON.parse(flags.records) as DnsRecord[];
    if (flags["dry-run"]) { console.log(`[dry-run] would add ${records.length} record(s) to ${domain}`); return; }
    try {
      const client = new GoDaddyClient(resolveConfigOrExit());
      await client.addRecords(domain, records);
      console.log(`Added ${records.length} record(s) to ${domain}`);
    } catch (err) { handleError(err); }
  },
});
```

- [ ] **Step 4: Create every command file per these tables.** Naming: `export const <name>Command`. Template column: A=list, B=get/positional, C=guarded-mutation, BODY=body-flag mutation.

**domains/** (group brief: "Manage domains")

| file | command export | template | positionals | flags | SDK call |
|---|---|---|---|---|---|
| list.ts | listDomainsCommand | A | — | status?, limit? | `listDomains({statuses,limit})` |
| get.ts | getDomainCommand | B | domain | — | `getDomain(domain)` |
| available.ts | availableDomainCommand | B | domain | `for-transfer?` (bool) | `checkAvailability(domain,{forTransfer})` |
| suggest.ts | suggestDomainsCommand | A | query (positional) | limit? | `suggestDomains(query,{limit})` |
| tlds.ts | listTldsCommand | A | — | — | `listTlds()` |
| agreements.ts | getAgreementsCommand | A | — | `tlds` (required, comma-split), privacy? | `getAgreements(tlds.split(','),{privacy})` |
| purchase.ts | purchaseDomainCommand | BODY | — | `body` (JSON string, required), dry-run | `purchaseDomain(JSON.parse(body))` |
| renew.ts | renewDomainCommand | C+period | domain | period? (number), yes, dry-run | `renewDomain(domain,{period})` |
| update-contacts.ts | updateDomainContactsCommand | BODY | domain | `contacts` (JSON string), dry-run | `updateDomainContacts(domain,JSON.parse(contacts))` |
| cancel.ts | cancelDomainCommand | C | domain | yes, dry-run | `cancelDomain(domain)` |

**transfers/** (group brief: "Domain transfers in and out")

| file | export | template | positionals | flags | SDK call |
|---|---|---|---|---|---|
| in.ts | transferInCommand | BODY | domain | `body` (JSON, required), yes, dry-run | `transferInDomain(domain,JSON.parse(body))` |
| status.ts | transferStatusCommand | B+cust | domain | customer-id? | `getTransferStatus(domain, flags["customer-id"])` |
| validate.ts | validateTransferCommand | BODY+cust | domain | body (JSON), customer-id? | `validateTransferIn(domain,JSON.parse(body),flags["customer-id"])` |
| accept-in.ts | acceptTransferInCommand | C+cust | domain | customer-id?, yes, dry-run | `acceptTransferIn(domain,flags["customer-id"])` |
| cancel-in.ts | cancelTransferInCommand | C+cust | domain | customer-id?, yes, dry-run | `cancelTransferIn(domain,flags["customer-id"])` |
| retry-in.ts | retryTransferInCommand | BODY+cust | domain | `auth-code` (required), customer-id?, dry-run | `retryTransferIn(domain,{authCode:flags["auth-code"]},flags["customer-id"])` |
| out.ts | transferOutCommand | C+cust | domain | customer-id?, yes, dry-run | `transferOutDomain(domain,flags["customer-id"])` |
| accept-out.ts | acceptTransferOutCommand | C+cust | domain | customer-id?, yes, dry-run | `acceptTransferOut(domain,flags["customer-id"])` |
| reject-out.ts | rejectTransferOutCommand | C+cust | domain | customer-id?, yes, dry-run | `rejectTransferOut(domain,flags["customer-id"])` |

For `+cust` add a flag `"customer-id": { kind: "parsed", parse: String, brief: "Customer ID (UUID); falls back to GODADDY_CUSTOMER_ID", optional: true }`.

**dns/** (group brief: "Manage DNS records")

| file | export | template | positionals | flags | SDK call |
|---|---|---|---|---|---|
| get.ts | getRecordsCommand | A | domain | type?, name? | `getRecords(domain,type,name)` |
| add.ts | addRecordsCommand | BODY | domain | records (JSON), dry-run | `addRecords(domain,JSON.parse(records))` |
| replace.ts | replaceRecordsCommand | BODY | domain | records (JSON), yes, dry-run | `replaceRecords(domain,JSON.parse(records))` |
| replace-type.ts | replaceRecordsByTypeCommand | BODY | domain, type | records (JSON), name?, yes, dry-run | `replaceRecordsByType(domain,type,JSON.parse(records),name)` |
| delete.ts | deleteRecordCommand | C | domain, type, name | yes, dry-run | `deleteRecord(domain,type,name)` |

**certificates/** (group brief: "Manage SSL certificates")

| file | export | template | positionals | flags | SDK call |
|---|---|---|---|---|---|
| create.ts | createCertificateCommand | BODY | — | body (JSON), dry-run | `createCertificate(JSON.parse(body))` |
| get.ts | getCertificateCommand | B | certificateId | — | `getCertificate(certificateId)` |
| list.ts | listCertificatesCommand | A | — | limit? | `listCertificates({limit})` |
| actions.ts | certificateActionsCommand | A | certificateId | — | `getCertificateActions(certificateId)` |
| download.ts | downloadCertificateCommand | B | certificateId | — | `downloadCertificate(certificateId)` |
| cancel.ts | cancelCertificateCommand | C | certificateId | yes, dry-run | `cancelCertificate(certificateId)` |

**orders/** (group brief: "View orders")

| file | export | template | positionals | flags | SDK call |
|---|---|---|---|---|---|
| list.ts | listOrdersCommand | A | — | limit? | `listOrders({limit})` |
| get.ts | getOrderCommand | B | orderId | — | `getOrder(orderId)` |

- [ ] **Step 5: Lint after creating all files**

```bash
bun run --filter '@godaddy-toolkit/cli' lint
```

Expected: clean. Fix any signature mismatches against the SDK (the SDK is the source of truth).

- [ ] **Step 6: Commit**

```bash
git add packages/cli && git commit -m "feat(cli): commands for domains, transfers, dns, certificates, orders"
```

---

## Task 10: CLI — `agent-context` + route map wiring

**Files:**
- Create: `packages/cli/src/commands/agent-context.ts`
- Modify: `packages/cli/src/app.ts`

- [ ] **Step 1: Create `agent-context.ts`** — emits a machine-readable command catalog:

```ts
import { buildCommand } from "@stricli/core";

const CATALOG = {
  name: "godaddy",
  version: "0.1.0",
  description: "Agent-native CLI for the GoDaddy API",
  env: ["GODADDY_API_KEY", "GODADDY_API_SECRET", "GODADDY_ENV(prod|ote)", "GODADDY_BASE_URL?", "GODADDY_SHOPPER_ID?", "GODADDY_CUSTOMER_ID?"],
  exitCodes: { network: 1, validation: 2, config: 3, notFound: 4, auth: 5, rateLimit: 6, dryRun: 0 },
  groups: {
    domains: ["list","get","available","suggest","tlds","agreements","purchase","renew","update-contacts","cancel"],
    transfers: ["in","status","validate","accept-in","cancel-in","retry-in","out","accept-out","reject-out"],
    dns: ["get","add","replace","replace-type","delete"],
    certificates: ["create","get","list","actions","download","cancel"],
    orders: ["list","get"],
  },
} as const;

export const agentContextCommand = buildCommand({
  docs: { brief: "Print machine-readable command catalog (JSON)" },
  parameters: { flags: {} },
  async func(this: void) { console.log(JSON.stringify(CATALOG, null, 2)); },
});
```

- [ ] **Step 2: Rewrite `app.ts`** with the full route map:

```ts
import { buildApplication, buildRouteMap } from "@stricli/core";
import { listDomainsCommand } from "./commands/domains/list.js";
import { getDomainCommand } from "./commands/domains/get.js";
import { availableDomainCommand } from "./commands/domains/available.js";
import { suggestDomainsCommand } from "./commands/domains/suggest.js";
import { listTldsCommand } from "./commands/domains/tlds.js";
import { getAgreementsCommand } from "./commands/domains/agreements.js";
import { purchaseDomainCommand } from "./commands/domains/purchase.js";
import { renewDomainCommand } from "./commands/domains/renew.js";
import { updateDomainContactsCommand } from "./commands/domains/update-contacts.js";
import { cancelDomainCommand } from "./commands/domains/cancel.js";
import { transferInCommand } from "./commands/transfers/in.js";
import { transferStatusCommand } from "./commands/transfers/status.js";
import { validateTransferCommand } from "./commands/transfers/validate.js";
import { acceptTransferInCommand } from "./commands/transfers/accept-in.js";
import { cancelTransferInCommand } from "./commands/transfers/cancel-in.js";
import { retryTransferInCommand } from "./commands/transfers/retry-in.js";
import { transferOutCommand } from "./commands/transfers/out.js";
import { acceptTransferOutCommand } from "./commands/transfers/accept-out.js";
import { rejectTransferOutCommand } from "./commands/transfers/reject-out.js";
import { getRecordsCommand } from "./commands/dns/get.js";
import { addRecordsCommand } from "./commands/dns/add.js";
import { replaceRecordsCommand } from "./commands/dns/replace.js";
import { replaceRecordsByTypeCommand } from "./commands/dns/replace-type.js";
import { deleteRecordCommand } from "./commands/dns/delete.js";
import { createCertificateCommand } from "./commands/certificates/create.js";
import { getCertificateCommand } from "./commands/certificates/get.js";
import { listCertificatesCommand } from "./commands/certificates/list.js";
import { certificateActionsCommand } from "./commands/certificates/actions.js";
import { downloadCertificateCommand } from "./commands/certificates/download.js";
import { cancelCertificateCommand } from "./commands/certificates/cancel.js";
import { listOrdersCommand } from "./commands/orders/list.js";
import { getOrderCommand } from "./commands/orders/get.js";
import { agentContextCommand } from "./commands/agent-context.js";

const routes = buildRouteMap({
  routes: {
    domains: buildRouteMap({ docs: { brief: "Manage domains" }, routes: {
      list: listDomainsCommand, get: getDomainCommand, available: availableDomainCommand,
      suggest: suggestDomainsCommand, tlds: listTldsCommand, agreements: getAgreementsCommand,
      purchase: purchaseDomainCommand, renew: renewDomainCommand,
      "update-contacts": updateDomainContactsCommand, cancel: cancelDomainCommand,
    }}),
    transfers: buildRouteMap({ docs: { brief: "Domain transfers in and out" }, routes: {
      in: transferInCommand, status: transferStatusCommand, validate: validateTransferCommand,
      "accept-in": acceptTransferInCommand, "cancel-in": cancelTransferInCommand, "retry-in": retryTransferInCommand,
      out: transferOutCommand, "accept-out": acceptTransferOutCommand, "reject-out": rejectTransferOutCommand,
    }}),
    dns: buildRouteMap({ docs: { brief: "Manage DNS records" }, routes: {
      get: getRecordsCommand, add: addRecordsCommand, replace: replaceRecordsCommand,
      "replace-type": replaceRecordsByTypeCommand, delete: deleteRecordCommand,
    }}),
    certificates: buildRouteMap({ docs: { brief: "Manage SSL certificates" }, routes: {
      create: createCertificateCommand, get: getCertificateCommand, list: listCertificatesCommand,
      actions: certificateActionsCommand, download: downloadCertificateCommand, cancel: cancelCertificateCommand,
    }}),
    orders: buildRouteMap({ docs: { brief: "View orders" }, routes: {
      list: listOrdersCommand, get: getOrderCommand,
    }}),
    "agent-context": agentContextCommand,
  },
  docs: { brief: "GoDaddy CLI — agent-native commands for domains, DNS, certificates, and orders" },
});

export const app = buildApplication(routes, { name: "godaddy", versionInfo: { currentVersion: "0.1.0" } });
```

- [ ] **Step 2b: Verify `bin.ts`** exists (scaffold-generated) and imports `./app.js`. If missing, create it:

```ts
#!/usr/bin/env bun
import { run } from "@stricli/core";
import { app } from "./app.js";
await run(app, process.argv.slice(2), { process });
```

- [ ] **Step 3: Smoke-test the CLI**

```bash
bun run --filter '@godaddy-toolkit/cli' lint
bun run dev:cli -- --help
bun run dev:cli -- agent-context
GODADDY_API_KEY=x GODADDY_API_SECRET=y bun run dev:cli -- domains list --dry-run 2>&1 | head -5
```

Expected: `--help` shows all groups; `agent-context` prints JSON; lint clean. (Live calls will fail without real creds — that's fine; we only assert wiring + help.)

- [ ] **Step 4: Commit + push**

```bash
git add packages/cli && git commit -m "feat(cli): agent-context command and route map wiring"
git push
```

---

## Task 11: MCP — shared helper + tool groups

**Files:**
- Create: `packages/mcp/src/tools/shared.ts`
- Create: `packages/mcp/src/tools/{domains,transfers,dns,certificates,orders}.ts`
- Modify: `packages/mcp/src/index.ts`
- Delete: `packages/mcp/src/tools/resources.ts` (scaffold placeholder)

MCP tools use `domain_verb_noun`-style names, TOON output, and a shared client built from `resolveConfig()`.

- [ ] **Step 1: Create `tools/shared.ts`:**

```ts
import { encode } from "@toon-format/toon";
import { GoDaddyClient, resolveConfig } from "@godaddy-toolkit/sdk";

export function makeClient(): GoDaddyClient {
  return new GoDaddyClient(resolveConfig());
}

export function toonText(result: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: encode(result ?? { ok: true }) }] };
}
```

- [ ] **Step 2: Exemplar tool group — `tools/domains.ts`:**

```ts
import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { makeClient, toonText } from "./shared.js";

export function registerDomainTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_list_domains",
    description: "List domains in the GoDaddy account (v1).",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status, e.g. ACTIVE"),
      limit: z.number().int().optional(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const client = makeClient();
      return toonText(await client.listDomains({ statuses: args.status ? [args.status] : undefined, limit: args.limit }));
    },
  });

  server.addTool({
    name: "godaddy_get_domain",
    description: "Get details for a single domain (v1).",
    parameters: z.object({ domain: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getDomain(args.domain)),
  });

  server.addTool({
    name: "godaddy_check_domain_availability",
    description: "Check if a domain is available to register (v1).",
    parameters: z.object({ domain: z.string(), forTransfer: z.boolean().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().checkAvailability(args.domain, { forTransfer: args.forTransfer })),
  });

  server.addTool({
    name: "godaddy_suggest_domains",
    description: "Suggest available domain names for a query (v1).",
    parameters: z.object({ query: z.string(), limit: z.number().int().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().suggestDomains(args.query, { limit: args.limit })),
  });

  server.addTool({
    name: "godaddy_purchase_domain",
    description: "Purchase/register a domain (v1). BILLABLE. Body must match the TLD purchase schema.",
    parameters: z.object({ body: z.record(z.unknown()).describe("Purchase payload") }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => toonText(await makeClient().purchaseDomain(args.body)),
  });

  server.addTool({
    name: "godaddy_cancel_domain",
    description: "Cancel (delete) a domain (v1). IRREVERSIBLE.",
    parameters: z.object({ domain: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => { await makeClient().cancelDomain(args.domain); return toonText({ canceled: args.domain }); },
  });
}
```

- [ ] **Step 3: Create the remaining tool groups** following the same pattern. Register every SDK method as a tool. Use the SDK signatures from Tasks 2–7. Naming + annotations table:

**transfers.ts → `registerTransferTools`** — `godaddy_transfer_in_domain` (destructive), `godaddy_get_transfer_status` (readOnly), `godaddy_validate_transfer_in`, `godaddy_accept_transfer_in`, `godaddy_cancel_transfer_in`, `godaddy_retry_transfer_in`, `godaddy_transfer_out_domain` (destructive), `godaddy_accept_transfer_out`, `godaddy_reject_transfer_out`. Each takes `domain` + optional `customerId` (+`authCode` for retry, `body` for in/validate); pass `customerId` straight through to the SDK method.

**dns.ts → `registerDnsTools`** — `godaddy_get_dns_records` (readOnly; params domain, type?, name?), `godaddy_add_dns_records` (params domain, records: array), `godaddy_replace_dns_records`, `godaddy_replace_dns_records_by_type` (domain, type, records, name?), `godaddy_delete_dns_record` (destructive; domain, type, name). For record arrays use `z.array(z.object({ type: z.string(), name: z.string(), data: z.string(), ttl: z.number().optional(), priority: z.number().optional() }).passthrough())`.

**certificates.ts → `registerCertificateTools`** — `godaddy_create_certificate` (destructive; body), `godaddy_get_certificate` (readOnly; certificateId), `godaddy_list_certificates` (readOnly; limit?), `godaddy_get_certificate_actions` (readOnly), `godaddy_download_certificate` (readOnly), `godaddy_cancel_certificate` (destructive).

**orders.ts → `registerOrderTools`** — `godaddy_list_orders` (readOnly; limit?), `godaddy_get_order` (readOnly; orderId).

- [ ] **Step 4: Rewrite `index.ts`:**

```ts
import { FastMCP } from "fastmcp";
import { registerDomainTools } from "./tools/domains.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerCertificateTools } from "./tools/certificates.js";
import { registerOrderTools } from "./tools/orders.js";

const server = new FastMCP({ name: "godaddy-toolkit", version: "0.1.0" });
registerDomainTools(server);
registerTransferTools(server);
registerDnsTools(server);
registerCertificateTools(server);
registerOrderTools(server);
server.start({ transportType: "stdio" });
```

- [ ] **Step 5: Delete placeholder + lint + inspect**

```bash
rm -f packages/mcp/src/tools/resources.ts
bun run --filter '@godaddy-toolkit/mcp' lint
bun run --filter '@godaddy-toolkit/mcp' inspect   # lists tools; Ctrl-C to exit
```

Expected: lint clean; inspector lists all registered tools.

- [ ] **Step 6: Commit + push**

```bash
git add packages/mcp && git commit -m "feat(mcp): tool groups for domains, transfers, dns, certificates, orders"
git push
```

---

## Task 12: Docs, env example, and final verification

**Files:**
- Modify: `.env.example`
- Create: `AGENTS.md`
- Modify: `README.md` (scaffold-generated — light edits)

- [ ] **Step 1: Rewrite `.env.example`:**

```
# GoDaddy API credentials — create at https://developer.godaddy.com/keys
GODADDY_API_KEY=your-api-key-here
GODADDY_API_SECRET=your-api-secret-here

# Environment: prod (default) -> api.godaddy.com, ote -> api.ote-godaddy.com
GODADDY_ENV=prod

# Optional explicit base URL override (wins over GODADDY_ENV)
# GODADDY_BASE_URL=https://api.godaddy.com

# Optional: X-Shopper-Id for reseller/sub-account calls
# GODADDY_SHOPPER_ID=

# Optional: customer UUID, used only by v2 transfer-management operations
# (falls back here when not passed as a --customer-id argument)
# GODADDY_CUSTOMER_ID=
```

- [ ] **Step 2: Create `AGENTS.md`** modeled on the sibling toolkits — Purpose, Quick start (bun commands), Repo layout, the v1/v2 strategy note (default v1; v2 only for transfer lifecycle + cert list; `customerId` arg→env fallback), and output-format convention. Keep it under ~120 lines.

- [ ] **Step 3: Edit `README.md`** — replace the generic "Resource" mentions with the real surface (domains/transfers/dns/certificates/orders) and add a credentials line pointing at `.env.example`.

- [ ] **Step 4: Full repo verification**

```bash
bun install
bun test
bun run lint
```

Expected: all packages' tests PASS; lint clean across sdk/cli/mcp. If anything fails, fix before committing.

- [ ] **Step 5: Final commit + push**

```bash
git add -A
git commit -m "docs: env example, AGENTS.md, and README for the real GoDaddy surface"
git push
```

- [ ] **Step 6: Confirm the public repo**

```bash
gh repo view spenserhale/godaddy-ai-toolkit --web
```

Expected: repo shows all commits, green tree.

---

## Self-Review (completed by plan author)

**Spec coverage:** Every spec API-surface entry maps to a task — Domains read (T2), Domains mutations (T3), Transfers in/out (T4), DNS (T5), Certificates (T6), Orders (T7); config/env + sso-key auth + error mapping (T1); CLI output/errors/commands/agent-context (T8–T10); MCP tools (T11); env/docs/verify + git push (T0, T12). The v1/v2 strategy and `customerId` arg→env fallback are implemented in T1 (`requireCustomerId`) and exercised in T4 tests.

**Placeholder scan:** No "TBD"/"handle errors appropriately" — error mapping, exit codes, and dry-run/confirm guards are spelled out with code. CLI/MCP repetitive files are specified by exact tables (file, export, template, params, SDK call), not "similar to".

**Type consistency:** Method names are consistent across SDK (`client.ts`), `index.ts` exports, CLI tables, and MCP tasks — `checkAvailability`, `suggestDomains`, `transferInDomain`, `getTransferStatus`, `replaceRecordsByType(domain,type,records,name?)`, `listCertificates`, etc. `requireCustomerId`/`v2DomainPath` are defined in T1/T4 and reused. Config fields (`apiKey/apiSecret/baseUrl/env/shopperId/customerId`) match across schema, `resolveConfig`, and tests.
