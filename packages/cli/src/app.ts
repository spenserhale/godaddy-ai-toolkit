import { buildApplication, buildRouteMap } from "@stricli/core";
import { listDomainsCommand } from "./commands/domains/list.js";
import { getDomainCommand } from "./commands/domains/get.js";
import { availableDomainCommand } from "./commands/domains/available.js";
import { suggestDomainsCommand } from "./commands/domains/suggest.js";
import { listTldsCommand } from "./commands/domains/tlds.js";
import { getAgreementsCommand } from "./commands/domains/agreements.js";
import { purchaseDomainCommand } from "./commands/domains/purchase.js";
import { renewDomainCommand } from "./commands/domains/renew.js";
import { updateDomainContactsCommand } from "./commands/domains/update-contacts.js";
import { cancelDomainCommand } from "./commands/domains/cancel.js";
import { transferInCommand } from "./commands/transfers/in.js";
import { transferStatusCommand } from "./commands/transfers/status.js";
import { validateTransferCommand } from "./commands/transfers/validate.js";
import { acceptTransferInCommand } from "./commands/transfers/accept-in.js";
import { cancelTransferInCommand } from "./commands/transfers/cancel-in.js";
import { retryTransferInCommand } from "./commands/transfers/retry-in.js";
import { transferOutCommand } from "./commands/transfers/out.js";
import { acceptTransferOutCommand } from "./commands/transfers/accept-out.js";
import { rejectTransferOutCommand } from "./commands/transfers/reject-out.js";
import { getRecordsCommand } from "./commands/dns/get.js";
import { addRecordsCommand } from "./commands/dns/add.js";
import { replaceRecordsCommand } from "./commands/dns/replace.js";
import { replaceRecordsByTypeCommand } from "./commands/dns/replace-type.js";
import { deleteRecordCommand } from "./commands/dns/delete.js";
import { createCertificateCommand } from "./commands/certificates/create.js";
import { getCertificateCommand } from "./commands/certificates/get.js";
import { listCertificatesCommand } from "./commands/certificates/list.js";
import { certificateActionsCommand } from "./commands/certificates/actions.js";
import { downloadCertificateCommand } from "./commands/certificates/download.js";
import { cancelCertificateCommand } from "./commands/certificates/cancel.js";
import { listOrdersCommand } from "./commands/orders/list.js";
import { getOrderCommand } from "./commands/orders/get.js";
import { agentContextCommand } from "./commands/agent-context.js";

const routes = buildRouteMap({
  routes: {
    domains: buildRouteMap({ docs: { brief: "Manage domains" }, routes: {
      list: listDomainsCommand, get: getDomainCommand, available: availableDomainCommand,
      suggest: suggestDomainsCommand, tlds: listTldsCommand, agreements: getAgreementsCommand,
      purchase: purchaseDomainCommand, renew: renewDomainCommand,
      "update-contacts": updateDomainContactsCommand, cancel: cancelDomainCommand,
    }}),
    transfers: buildRouteMap({ docs: { brief: "Domain transfers in and out" }, routes: {
      in: transferInCommand, status: transferStatusCommand, validate: validateTransferCommand,
      "accept-in": acceptTransferInCommand, "cancel-in": cancelTransferInCommand, "retry-in": retryTransferInCommand,
      out: transferOutCommand, "accept-out": acceptTransferOutCommand, "reject-out": rejectTransferOutCommand,
    }}),
    dns: buildRouteMap({ docs: { brief: "Manage DNS records" }, routes: {
      get: getRecordsCommand, add: addRecordsCommand, replace: replaceRecordsCommand,
      "replace-type": replaceRecordsByTypeCommand, delete: deleteRecordCommand,
    }}),
    certificates: buildRouteMap({ docs: { brief: "Manage SSL certificates" }, routes: {
      create: createCertificateCommand, get: getCertificateCommand, list: listCertificatesCommand,
      actions: certificateActionsCommand, download: downloadCertificateCommand, cancel: cancelCertificateCommand,
    }}),
    orders: buildRouteMap({ docs: { brief: "View orders" }, routes: {
      list: listOrdersCommand, get: getOrderCommand,
    }}),
    "agent-context": agentContextCommand,
  },
  docs: { brief: "GoDaddy CLI — agent-native commands for domains, DNS, certificates, and orders" },
});

export const app = buildApplication(routes, { name: "godaddy", versionInfo: { currentVersion: "0.1.0" } });
