import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const GoDaddyConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
  baseUrl: z.string().url().default("https://api.godaddy.com"),
  env: z.enum(["prod", "ote"]).default("prod"),
  shopperId: z.string().optional(),
  customerId: z.string().optional(),
});
export type GoDaddyConfig = z.infer<typeof GoDaddyConfigSchema>;

// ---------------------------------------------------------------------------
// Error envelope
// ---------------------------------------------------------------------------

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

export const TransferStatusSchema = z.object({
  domain: z.string().optional(),
  status: z.string().optional(),
  registrar: z.string().optional(),
}).passthrough();
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const TransferInBodySchema = z.record(z.unknown()); // purchase + authCode + contacts; varies by TLD
export type TransferInBody = z.infer<typeof TransferInBodySchema>;

// ---------------------------------------------------------------------------
// DNS records
// ---------------------------------------------------------------------------

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
