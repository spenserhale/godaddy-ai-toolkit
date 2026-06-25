import { FastMCP } from "fastmcp";
import { registerDomainTools } from "./tools/domains.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerCertificateTools } from "./tools/certificates.js";
import { registerOrderTools } from "./tools/orders.js";

const server = new FastMCP({ name: "godaddy-toolkit", version: "0.1.0" });
registerDomainTools(server);
registerTransferTools(server);
registerDnsTools(server);
registerCertificateTools(server);
registerOrderTools(server);
server.start({ transportType: "stdio" });
