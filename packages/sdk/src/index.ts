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
