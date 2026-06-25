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
