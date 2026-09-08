import { Router } from "express";

const router = Router();

// Returns the predefined system roles for Bharat Organic Expo
// No auth required — roles are used in the staff creation form
router.get("/admin", (_req, res) => {
  const roles = [
    {
      _id: "role_superadmin",
      slug: "SUPER_ADMIN",
      name: "Super Admin",
      description: "Full system control across all operational modules.",
      isSystem: true,
      status: "ACTIVE",
      permissions: ["*"],
      createdAt: new Date().toISOString(),
    },
    {
      _id: "role_admin",
      slug: "EXPO_ADMIN",
      name: "Expo Admin",
      description: "Manage exhibitors, buyers, stalls, and staff operations.",
      isSystem: false,
      status: "ACTIVE",
      permissions: ["exhibitors.*", "buyers.*", "stalls.*", "staff.view"],
      createdAt: new Date().toISOString(),
    },
  ];

  res.status(200).json({
    success: true,
    message: "Roles list",
    data: roles,
  });
});

// Also respond on root path for compatibility
router.get("/", (_req, res) => {
  res.redirect(301, "/api/v1/roles/admin");
});

export default router;
