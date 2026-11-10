import {
  GoDaddyAuthError, GoDaddyNotFoundError, GoDaddyValidationError, GoDaddyRateLimitError, GoDaddyError,
  loadConfig, GoDaddyConfigError,
} from "@godaddy-toolkit/sdk";
import type { GoDaddyConfig } from "@godaddy-toolkit/sdk";

export async function resolveConfigOrExit(): Promise<GoDaddyConfig> {
  try {
    return await loadConfig();
  } catch (err) {
    console.error(`Config error: ${err instanceof Error ? err.message : String(err)}. Run godaddy auth set godaddy, or set GODADDY_API_KEY and GODADDY_API_SECRET.`);
    process.exit(3);
  }
}

export function handleError(err: unknown): never {
  if (err instanceof GoDaddyConfigError) { console.error(`Config error: ${err.message}`); process.exit(3); }
  if (err instanceof GoDaddyAuthError) { console.error(`Auth error: ${err.message}`); process.exit(5); }
  if (err instanceof GoDaddyNotFoundError) { console.error(`Not found: ${err.message}`); process.exit(4); }
  if (err instanceof GoDaddyRateLimitError) { console.error(`Rate limit exceeded: ${err.message}`); process.exit(6); }
  if (err instanceof GoDaddyValidationError) { console.error(`Validation error: ${err.message}`); process.exit(2); }
  if (err instanceof GoDaddyError) { console.error(`API error: ${err.message}`); process.exit(1); }
  if (err instanceof Error && err.name === "ZodError") { console.error(`Validation error: ${err.message}`); process.exit(2); }
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
