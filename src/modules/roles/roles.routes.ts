import { Router, Request, Response } from "express";
import { Role } from "../../models/Role.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

const router = Router();

// Standard system permissions for Bharat Organic Expo
export const SYSTEM_PERMISSIONS = [
  { _id: "perm_exhibitors_view", module: "Exhibitors", action: "View", key: "exhibitors.view", label: "View Exhibitor Profiles & Stalls" },
  { _id: "perm_exhibitors_create", module: "Exhibitors", action: "Create", key: "exhibitors.create", label: "Register New Exhibitors" },
  { _id: "perm_exhibitors_edit", module: "Exhibitors", action: "Edit", key: "exhibitors.edit", label: "Edit Exhibitor Data & Documents" },
  { _id: "perm_exhibitors_delete", module: "Exhibitors", action: "Delete", key: "exhibitors.delete", label: "Delete / Reject Exhibitors" },
  { _id: "perm_buyers_view", module: "Buyers & Visitors", action: "View", key: "buyers.view", label: "View Buyer Registrations" },
  { _id: "perm_buyers_verify", module: "Buyers & Visitors", action: "Verify", key: "buyers.verify", label: "Verify Trade Credentials" },
  { _id: "perm_buyers_export", module: "Buyers & Visitors", action: "Export", key: "buyers.export", label: "Export Visitor / Buyer Lists" },
  { _id: "perm_stalls_view", module: "Stalls & Pavilions", action: "View", key: "stalls.view", label: "View Stall Allocations & Maps" },
  { _id: "perm_stalls_allocate", module: "Stalls & Pavilions", action: "Allocate", key: "stalls.allocate", label: "Allocate / Reassign Stalls" },
  { _id: "perm_staff_view", module: "Staff & Roles", action: "View", key: "staff.view", label: "View Staff Accounts" },
  { _id: "perm_staff_invite", module: "Staff & Roles", action: "Invite", key: "staff.invite", label: "Create / Invite Staff" },
  { _id: "perm_staff_edit", module: "Staff & Roles", action: "Edit", key: "staff.edit", label: "Edit Staff & Roles" },
  { _id: "perm_content_view", module: "Content & CMS", action: "View", key: "content.view", label: "View Pages, Blogs & Events" },
  { _id: "perm_content_edit", module: "Content & CMS", action: "Edit", key: "content.edit", label: "Publish / Edit Content" },
  { _id: "perm_enquiries_view", module: "Enquiries & Leads", action: "View", key: "enquiries.view", label: "View Inbound Enquiries" },
  { _id: "perm_enquiries_reply", module: "Enquiries & Leads", action: "Reply", key: "enquiries.reply", label: "Reply to Trade Enquiries" },
  { _id: "perm_settings_manage", module: "System & Settings", action: "Manage", key: "settings.manage", label: "System Alerts & Config" },
];

// Helper to seed initial system roles if they don't exist
async function ensureSeedRoles() {
  const count = await Role.countDocuments();
  if (count === 0) {
    const allPermIds = SYSTEM_PERMISSIONS.map((p) => p._id);
    await Role.create([
      {
        name: "Super Admin",
        slug: "SUPER_ADMIN",
        description: "Full system control across all operational modules.",
        isSystem: true,
        status: "ACTIVE",
        permissionIds: allPermIds,
      },
      {
        name: "Expo Admin",
        slug: "EXPO_ADMIN",
        description: "Manage exhibitors, buyers, stalls, and staff operations.",
        isSystem: false,
        status: "ACTIVE",
        permissionIds: [
          "perm_exhibitors_view",
          "perm_exhibitors_create",
          "perm_exhibitors_edit",
          "perm_buyers_view",
          "perm_buyers_verify",
          "perm_stalls_view",
          "perm_staff_view",
          "perm_enquiries_view",
          "perm_enquiries_reply",
        ],
      },
    ]);
  }
}

// 1. GET /api/v1/roles/admin/permissions
router.get(
  "/admin/permissions",
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(ApiResponse.ok("Permissions list", SYSTEM_PERMISSIONS));
  })
);

// 2. GET /api/v1/roles/admin - List all roles
router.get(
  "/admin",
  asyncHandler(async (_req: Request, res: Response) => {
    await ensureSeedRoles();
    const roles = await Role.find().sort({ isSystem: -1, createdAt: 1 });

    const formatted = roles.map((r) => {
      const perms = SYSTEM_PERMISSIONS.filter((p) => r.permissionIds?.includes(p._id));
      return {
        _id: r._id.toString(),
        name: r.name,
        slug: r.slug,
        description: r.description || "",
        isSystem: r.isSystem,
        status: r.status,
        permissionIds: r.permissionIds || [],
        permissions: perms,
        createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      };
    });

    res.status(200).json(ApiResponse.ok("Roles list", formatted));
  })
);

// 3. POST /api/v1/roles/admin - Create a new role
router.post(
  "/admin",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, description, permissionIds } = req.body;

    if (!name || !name.trim()) {
      throw ApiError.badRequest("Role name is required.");
    }
    if (!slug || !slug.trim()) {
      throw ApiError.badRequest("Role slug is required.");
    }

    const normalizedSlug = slug
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");

    const existing = await Role.findOne({ slug: normalizedSlug });
    if (existing) {
      throw ApiError.badRequest(`A role with slug '${normalizedSlug}' already exists.`);
    }

    const newRole = await Role.create({
      name: name.trim(),
      slug: normalizedSlug,
      description: description?.trim() || "",
      permissionIds: Array.isArray(permissionIds) ? permissionIds : [],
      isSystem: false,
      status: "ACTIVE",
    });

    const perms = SYSTEM_PERMISSIONS.filter((p) => newRole.permissionIds?.includes(p._id));

    res.status(201).json(
      ApiResponse.created("Role created successfully", {
        _id: newRole._id.toString(),
        name: newRole.name,
        slug: newRole.slug,
        description: newRole.description || "",
        isSystem: newRole.isSystem,
        status: newRole.status,
        permissionIds: newRole.permissionIds || [],
        permissions: perms,
        createdAt: newRole.createdAt.toISOString(),
      })
    );
  })
);

// 4. PUT /api/v1/roles/admin/:id - Update an existing role
router.put(
  "/admin/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, permissionIds, status } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      throw ApiError.notFound("Role not found.");
    }

    if (name && name.trim()) role.name = name.trim();
    if (description !== undefined) role.description = description.trim();
    if (Array.isArray(permissionIds)) role.permissionIds = permissionIds;
    if (status && (status === "ACTIVE" || status === "INACTIVE")) {
      // Don't allow deactivating system role
      if (role.isSystem && status === "INACTIVE") {
        throw ApiError.badRequest("System roles cannot be deactivated.");
      }
      role.status = status;
    }

    await role.save();

    const perms = SYSTEM_PERMISSIONS.filter((p) => role.permissionIds?.includes(p._id));

    res.status(200).json(
      ApiResponse.ok("Role updated successfully", {
        _id: role._id.toString(),
        name: role.name,
        slug: role.slug,
        description: role.description || "",
        isSystem: role.isSystem,
        status: role.status,
        permissionIds: role.permissionIds || [],
        permissions: perms,
        createdAt: role.createdAt.toISOString(),
      })
    );
  })
);

// 5. DELETE /api/v1/roles/admin/:id - Delete a custom role
router.delete(
  "/admin/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      throw ApiError.notFound("Role not found.");
    }

    if (role.isSystem) {
      throw ApiError.badRequest("System roles cannot be deleted.");
    }

    await Role.findByIdAndDelete(id);

    res.status(200).json(ApiResponse.ok("Role deleted successfully", null));
  })
);

// Compatibility route: GET /api/v1/roles
router.get("/", (_req, res) => {
  res.redirect(301, "/api/v1/roles/admin");
});

export default router;
