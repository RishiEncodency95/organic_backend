import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isValidObjectId } from "mongoose";
import { Admin } from "../../models/Admin.model";
import { Role } from "../../models/Role.model";
import { protect } from "../../middlewares/auth.middleware";
import { E, type InfraActor } from "./infra.util";

/**
 * Permission ids of the Infrastructure module. They live in the existing Roles system (SYSTEM_PERMISSIONS in
 * roles.routes.ts) so they can be granted from Roles & Permissions. Mapping from the original capabilities:
 *   clients:read -> VIEW, clients:write -> MANAGE, billing:read/write -> BILLING_VIEW / BILLING_MANAGE,
 *   integrations:read/write -> INTEGRATIONS_VIEW / INTEGRATIONS_MANAGE.
 * Super admins hold every permission.
 */
export const INFRA_PERM = {
  VIEW: "perm_infra_view",
  MANAGE: "perm_infra_manage",
  BILLING_VIEW: "perm_infra_billing_view",
  BILLING_MANAGE: "perm_infra_billing_manage",
  INTEGRATIONS_VIEW: "perm_infra_integrations_view",
  INTEGRATIONS_MANAGE: "perm_infra_integrations_manage",
} as const;

export { INFRA_PERMISSION_DEFS } from "./infra.permissions";

const ALL = new Set<string>(Object.values(INFRA_PERM));

/**
 * Resolves the logged-in admin's infrastructure permissions. Same role resolution as middlewares/permission.middleware
 * (roleId, else roleName, else the default Expo Admin role); a missing/inactive account or role grants nothing.
 */
export async function loadActor(userId: string): Promise<InfraActor> {
  if (!isValidObjectId(userId)) throw E.unauthorized("Unauthorized");
  const admin = await Admin.findById(userId).select("name email role roleId roleName isActive").lean<any>();
  if (!admin || !admin.isActive) throw E.forbidden("Your account is not active");
  const superAdmin = admin.role === "superadmin";
  let perms = new Set<string>();
  if (superAdmin) perms = new Set(ALL);
  else {
    const role =
      (admin.roleId && isValidObjectId(admin.roleId) ? await Role.findById(admin.roleId).lean<any>() : null) ||
      (admin.roleName ? await Role.findOne({ name: admin.roleName }).lean<any>() : null) ||
      (await Role.findOne({ slug: "EXPO_ADMIN" }).lean<any>());
    if (role && role.status === "ACTIVE") perms = new Set((role.permissionIds ?? []).filter((p: string) => ALL.has(p)));
  }
  return {
    userId: String(admin._id),
    name: admin.name || admin.email || "Admin",
    email: admin.email,
    superAdmin,
    perms,
    can: (p: string) => perms.has(p),
    privileged: superAdmin || perms.has(INFRA_PERM.INTEGRATIONS_MANAGE),
  };
}

declare module "express-serve-static-core" {
  interface Request {
    infraActor?: InfraActor;
  }
}

/** Authenticates (JWT) and requires the permission. Every infrastructure management route goes through this. */
export const guard = (permission: string): RequestHandler[] => [
  protect,
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const actor = await loadActor(req.user!.id);
      if (!actor.can(permission)) throw E.forbidden("You don't have permission for this action", "infra_permission_denied");
      req.infraActor = actor;
      next();
    } catch (e) {
      next(e);
    }
  },
];

export const actorOf = (req: Request): InfraActor => {
  if (!req.infraActor) throw E.unauthorized("Unauthorized");
  return req.infraActor;
};
