/**
 * Permission definitions of the Infrastructure module. Kept free of database imports so the Roles screen can list
 * them without loading the module's models.
 */
export const INFRA_PERMISSION_DEFS = [
  { _id: "perm_infra_view", module: "Infrastructure", action: "View", key: "infrastructure.view", label: "View Servers, Domains, SSL & Alerts" },
  { _id: "perm_infra_manage", module: "Infrastructure", action: "Manage", key: "infrastructure.manage", label: "Add / Edit / Archive Infrastructure Assets & Alerts" },
  { _id: "perm_infra_billing_view", module: "Infrastructure", action: "Billing View", key: "infrastructure.billing.view", label: "View Infrastructure Costs & Payment History" },
  { _id: "perm_infra_billing_manage", module: "Infrastructure", action: "Billing Manage", key: "infrastructure.billing.manage", label: "Manage Subscriptions & Confirm Payments" },
  { _id: "perm_infra_integrations_view", module: "Infrastructure", action: "Integrations View", key: "infrastructure.integrations.view", label: "View Provider Connections" },
  { _id: "perm_infra_integrations_manage", module: "Infrastructure", action: "Integrations Manage", key: "infrastructure.integrations.manage", label: "Manage Providers, Collectors, Thresholds & Alert Settings" },
];

/** The module is off unless the deployment opts in, so a deploy never creates collections or schedules work unannounced. */
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Mounts a router that is only imported (and so only registers its models / touches the database) the first time the
 * module is enabled and a request reaches it. While disabled it answers 503 without loading anything.
 */
export function lazyInfraRouter(load: () => Promise<{ default?: RequestHandler; infraIngestRouter?: RequestHandler }>, pick: "default" | "infraIngestRouter" = "default"): RequestHandler {
  let loaded: RequestHandler | null = null;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!infrastructureEnabled()) {
      res.status(503).json({ success: false, statusCode: 503, message: "The Infrastructure module is not enabled on this server.", code: "infra_disabled" });
      return;
    }
    (loaded ? Promise.resolve(loaded) : load().then((m) => (loaded = (m[pick] as RequestHandler))))
      .then((handler) => handler(req, res, next))
      .catch(next);
  };
}

export const infrastructureEnabled = (): boolean => process.env.INFRASTRUCTURE_ENABLED === "true";
