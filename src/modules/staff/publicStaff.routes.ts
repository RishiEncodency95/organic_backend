import { Request, Response, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { Admin } from "../../models/Admin.model";
import { Role } from "../../models/Role.model";

/*
 * Public staff list for the "Spoken with" dropdown on Book a Stand. It lists the
 * exhibitor team: active staff whose role may register or edit exhibitors — so who
 * appears is controlled from the Roles page.
 * Only a display name and handle go out — never email, phone or account details.
 */
const EXHIBITOR_TEAM_PERMISSIONS = ["perm_exhibitors_create", "perm_exhibitors_edit"];

const listExhibitorTeam = asyncHandler(async (_req: Request, res: Response) => {
  const [staff, roles] = await Promise.all([
    Admin.find({ isActive: true }).select("name email employeeId roleId roleName").sort({ name: 1 }).lean(),
    Role.find({ status: "ACTIVE" }).select("name slug permissionIds").lean(),
  ]);

  const byId = new Map(roles.map((r: any) => [String(r._id), r]));
  const byName = new Map(roles.map((r: any) => [r.name, r]));
  const fallback = roles.find((r: any) => r.slug === "EXPO_ADMIN");

  // Same role resolution as requirePermission: roleId, then roleName, then Expo Admin.
  const data = staff
    .filter((s: any) => {
      const role = (s.roleId && byId.get(String(s.roleId))) || (s.roleName && byName.get(s.roleName)) || fallback;
      return role && EXHIBITOR_TEAM_PERMISSIONS.some((p) => role.permissionIds?.includes(p));
    })
    .map((s: any) => ({
      _id: String(s._id),
      username: s.employeeId || String(s.email || "").split("@")[0],
      fullName: s.name,
      roleName: s.roleName || "",
    }));

  res.status(200).json(new ApiResponse(200, "Staff fetched successfully", data));
});

const router = Router();
router.get("/employees", listExhibitorTeam);
router.get("/staff", listExhibitorTeam);

export default router;
