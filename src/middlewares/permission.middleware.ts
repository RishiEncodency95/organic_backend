import { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { Admin } from "../models/Admin.model";
import { Role } from "../models/Role.model";
import { ApiError } from "../utils/ApiError";

/**
 * Checks the logged-in staff member's role for one of the given permission ids
 * (see SYSTEM_PERMISSIONS in roles.routes.ts, e.g. "perm_content_edit").
 * Use after `protect`. Super admins always pass.
 *
 * A staff member's role is their roleId, else their roleName, else the default
 * Expo Admin role — the same fallback the staff list uses.
 */
export const requirePermission =
  (...permissionIds: string[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as { id?: string; role?: string } | undefined;
      if (!user?.id) throw ApiError.unauthorized();
      if (user.role === "superadmin") return next();

      const admin = await Admin.findById(user.id).select("role roleId roleName isActive").lean();
      if (!admin || !admin.isActive) throw ApiError.forbidden("Your account is not active");
      if (admin.role === "superadmin") return next();

      const role =
        (admin.roleId && isValidObjectId(admin.roleId) ? await Role.findById(admin.roleId).lean() : null) ||
        (admin.roleName ? await Role.findOne({ name: admin.roleName }).lean() : null) ||
        (await Role.findOne({ slug: "EXPO_ADMIN" }).lean());

      if (!role || role.status !== "ACTIVE") throw ApiError.forbidden("Your role is not active");
      if (!permissionIds.some((id) => role.permissionIds?.includes(id))) {
        throw ApiError.forbidden("You don't have permission for this action");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
