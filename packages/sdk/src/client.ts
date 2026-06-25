import {
  GoDaddyConfigSchema, GoDaddyErrorResponseSchema,
  DomainSummarySchema, DomainDetailSchema, DomainAvailableSchema,
  DomainSuggestionSchema, TldSummarySchema, LegalAgreementSchema,
  DomainPurchaseResultSchema, TransferStatusSchema,
  DnsRecordSchema,
  CertificateSchema, CertificateActionSchema,
  OrderSchema,
} from "./types.js";
import type {
  GoDaddyConfig, DomainSummary, DomainDetail, DomainAvailable,
  DomainSuggestion, TldSummary, LegalAgreement,
  DomainContact, DomainPurchase, DomainPurchaseResult,
  TransferStatus, TransferInBody,
  DnsRecord, DnsRecordType,
  Certificate, CertificateCreate, CertificateAction,
  Order,
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

  // === TRANSFERS (Task 4) ===

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

  // === DNS RECORDS (Task 5) ===

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

  // === CERTIFICATES (Task 6) ===

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

  // === ORDERS (Task 7) ===

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
}
