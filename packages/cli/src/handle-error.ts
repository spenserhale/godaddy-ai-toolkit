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
