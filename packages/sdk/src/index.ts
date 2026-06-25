export { GodaddyClient } from "./client.js";
export { resolveConfig } from "./config.js";
export { GodaddyError, GodaddyAuthError, GodaddyNotFoundError } from "./errors.js";
export type {
  GodaddyConfig,
  Resource,
  ListResourcesParams,
  CreateResourceParams,
  PaginatedResponse,
  ErrorResponse,
} from "./types.js";
export {
  GodaddyConfigSchema,
  ResourceSchema,
  ListResourcesParamsSchema,
  CreateResourceParamsSchema,
  ErrorResponseSchema,
} from "./types.js";
