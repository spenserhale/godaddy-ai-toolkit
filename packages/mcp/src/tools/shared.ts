import { encode } from "@toon-format/toon";
import { GoDaddyClient, loadConfig, type GoDaddyConfig } from "@godaddy-toolkit/sdk";

export async function makeClient(load: () => Promise<GoDaddyConfig> = loadConfig): Promise<GoDaddyClient> {
  return new GoDaddyClient(await load());
}

export function toonText(result: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: encode(result ?? { ok: true }) }] };
}
