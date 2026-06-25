import { buildApplication, buildRouteMap } from "@stricli/core";
import { listCommand } from "./commands/list.js";
import { getCommand } from "./commands/get.js";
import { createCommand } from "./commands/create.js";
import { deleteCommand } from "./commands/delete.js";

const resourceRoutes = buildRouteMap({
  routes: {
    list: listCommand,
    get: getCommand,
    create: createCommand,
    delete: deleteCommand,
  },
  docs: {
    brief: "Manage Godaddy resources",
  },
});

const routes = buildRouteMap({
  routes: {
    resources: resourceRoutes,
  },
  docs: {
    brief: "SDK, CLI, and MCP server for the GoDaddy API (domains, DNS, certificates, orders)",
  },
});

export const app = buildApplication(routes, {
  name: "godaddy",
  versionInfo: {
    currentVersion: "0.1.0",
  },
});
