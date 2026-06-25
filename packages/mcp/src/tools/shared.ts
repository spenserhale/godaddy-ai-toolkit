import { encode } from "@toon-format/toon";
import { GoDaddyClient, resolveConfig } from "@godaddy-toolkit/sdk";

export function makeClient(): GoDaddyClient {
  return new GoDaddyClient(resolveConfig());
}

export function toonText(result: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: encode(result ?? { ok: true }) }] };
}
