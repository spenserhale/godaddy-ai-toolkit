import { describe, expect, it } from "bun:test";
import { GodaddyClient } from "../src/client.js";

describe("GodaddyClient", () => {
  it("should require an API key", () => {
    expect(() => new GodaddyClient({ apiKey: "" })).toThrow();
  });

  it("should accept a valid config", () => {
    const client = new GodaddyClient({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
    });
    expect(client).toBeDefined();
  });
});
