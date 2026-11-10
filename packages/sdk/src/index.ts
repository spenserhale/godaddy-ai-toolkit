export { GoDaddyClient } from "./client.js";
export { resolveConfig, loadConfig } from "./config.js";
export type { ResolvedConfig, ResolveConfigOptions, LoadConfigOptions, Env } from "./config.js";
export { KEYCHAIN_SERVICE, CREDENTIAL_KEYS, CREDENTIAL_RESOURCES, credentialKeys, resourceForCredentialKey, bunSecretStore, readKeychainValues, hasBunSecrets } from "./secrets.js";
export type { SecretStore, ResourceId, KeychainState, KeychainStatus, KeychainReadResult } from "./secrets.js";
export {
  GoDaddyError, GoDaddyAuthError, GoDaddyNotFoundError, GoDaddyValidationError, GoDaddyRateLimitError, GoDaddyConfigError,
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
