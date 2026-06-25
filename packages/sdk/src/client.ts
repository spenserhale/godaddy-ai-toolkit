import {
  GoDaddyConfigSchema, GoDaddyErrorResponseSchema,
  DomainSummarySchema, DomainDetailSchema, DomainAvailableSchema,
  DomainSuggestionSchema, TldSummarySchema, LegalAgreementSchema,
} from "./types.js";
import type {
  GoDaddyConfig, DomainSummary, DomainDetail, DomainAvailable,
  DomainSuggestion, TldSummary, LegalAgreement,
} from "./types.js";
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

  // === TRANSFERS (Task 4) ===
  // === DNS RECORDS (Task 5) ===
  // === CERTIFICATES (Task 6) ===
  // === ORDERS (Task 7) ===
}
