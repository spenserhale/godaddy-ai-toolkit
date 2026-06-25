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
