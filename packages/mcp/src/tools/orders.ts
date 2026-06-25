import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { makeClient, toonText } from "./shared.js";

export function registerOrderTools(server: FastMCP): void {
  server.addTool({
    name: "godaddy_list_orders",
    description: "List billing orders for the account (v1).",
    parameters: z.object({ limit: z.number().int().optional() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().listOrders({ limit: args.limit })),
  });

  server.addTool({
    name: "godaddy_get_order",
    description: "Get details for a single order by id (v1).",
    parameters: z.object({ orderId: z.string() }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getOrder(args.orderId)),
  });
}
