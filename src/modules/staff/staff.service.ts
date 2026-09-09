import { Admin } from "../../models/Admin.model";
import { Role } from "../../models/Role.model";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import argon2 from "argon2";
import crypto from "crypto";

export interface InviteStaffDTO {
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  roleId?: string;
  avatarUrl?: string;
}

export const listStaffService = async () => {
  const [staff, allRoles] = await Promise.all([
    Admin.find().sort({ createdAt: -1 }),
    Role.find().lean(),
  ]);
  const rolesMap = new Map(allRoles.map((r) => [r._id.toString(), r.name]));

  return staff.map((member) => {
    const isLocked = !!(member.lockUntil && new Date(member.lockUntil) > new Date());
    const status = isLocked ? "LOCKED" : member.isActive ? "ACTIVE" : "INACTIVE";

    let roleName = member.roleName || (member.role === "superadmin" ? "Super Admin" : "Expo Admin");
    let roleId = member.roleId;
    if (roleId && rolesMap.has(roleId)) {
      roleName = rolesMap.get(roleId)!;
    } else {
      const defaultRole = allRoles.find((r) => r.slug === (member.role === "superadmin" ? "SUPER_ADMIN" : "EXPO_ADMIN"));
      if (defaultRole) {
        roleId = defaultRole._id.toString();
        roleName = defaultRole.name;
      }
    }

    return {
      _id: member._id.toString(),
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      employeeId: member.employeeId || `EMP-${member._id.toString().slice(-4).toUpperCase()}`,
      roleId: roleId || (member.role === "superadmin" ? "role_superadmin" : "role_admin"),
      roleName,
      status,
      lockUntil: member.lockUntil ? member.lockUntil.toISOString() : null,
      avatarUrl: member.avatarUrl || null,
      lastLoginAt: member.lastLogin ? member.lastLogin.toISOString() : null,
      createdAt: member.createdAt ? member.createdAt.toISOString() : new Date().toISOString(),
    };
  });
};

export const inviteStaffService = async (data: InviteStaffDTO) => {
  const { name, email, phone, employeeId, roleId, avatarUrl } = data;

  const existingEmail = await Admin.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw ApiError.badRequest("Staff account with this email already exists.");
  }

  // Generate temporary password (e.g. OrgExpo#9284)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const temporaryPassword = `OrgExpo#${randomNum}`;

  let assignedRole: "superadmin" | "admin" = "admin";
  let assignedRoleName = "Expo Admin";
  let resolvedRoleId = roleId;

  if (roleId) {
    const roleDoc = await Role.findById(roleId);
    if (roleDoc) {
      assignedRoleName = roleDoc.name;
      if (roleDoc.slug === "SUPER_ADMIN") assignedRole = "superadmin";
    }
  } else {
    const defaultRole = await Role.findOne({ slug: "EXPO_ADMIN" });
    if (defaultRole) {
      resolvedRoleId = defaultRole._id.toString();
      assignedRoleName = defaultRole.name;
    }
  }

  const newAdmin = await Admin.create({
    name,
    email: email.toLowerCase(),
    phone: phone || "",
    employeeId: employeeId || `EMP-${randomNum}`,
    password: temporaryPassword,
    role: assignedRole,
    roleId: resolvedRoleId,
    roleName: assignedRoleName,
    avatarUrl: avatarUrl || "",
    isTwoFactorEnabled: false, // 2FA mandatory on first login!
    isActive: true,
  });

  logger.info(`New staff account created: ${newAdmin.email} (Emp ID: ${newAdmin.employeeId})`);

  return {
    user: {
      _id: newAdmin._id.toString(),
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      employeeId: newAdmin.employeeId,
      roleId: newAdmin.roleId || (newAdmin.role === "superadmin" ? "role_superadmin" : "role_admin"),
      roleName: newAdmin.roleName || (newAdmin.role === "superadmin" ? "Super Admin" : "Expo Admin"),
      status: "ACTIVE",
      avatarUrl: newAdmin.avatarUrl || null,
      createdAt: newAdmin.createdAt.toISOString(),
    },
    temporaryPassword,
  };
};

export const updateStaffService = async (id: string, data: Partial<InviteStaffDTO>) => {
  const admin = await Admin.findById(id);
  if (!admin) {
    throw ApiError.notFound("Staff member not found.");
  }

  if (data.name) admin.name = data.name;
  if (data.email) admin.email = data.email.toLowerCase();
  if (data.phone !== undefined) admin.phone = data.phone;
  if (data.employeeId !== undefined) admin.employeeId = data.employeeId;
  if (data.avatarUrl !== undefined) admin.avatarUrl = data.avatarUrl;
  if (data.roleId) {
    admin.roleId = data.roleId;
    const roleDoc = await Role.findById(data.roleId);
    if (roleDoc) {
      admin.roleName = roleDoc.name;
      admin.role = roleDoc.slug === "SUPER_ADMIN" ? "superadmin" : "admin";
    }
  }

  await admin.save();

  return {
    _id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    phone: admin.phone || "",
    employeeId: admin.employeeId || "",
    roleId: admin.roleId || (admin.role === "superadmin" ? "role_superadmin" : "role_admin"),
    roleName: admin.roleName || (admin.role === "superadmin" ? "Super Admin" : "Expo Admin"),
    status: admin.isActive ? "ACTIVE" : "INACTIVE",
    avatarUrl: admin.avatarUrl || null,
  };
};

export const updateStaffStatusService = async (id: string, status: "ACTIVE" | "INACTIVE" | "LOCKED") => {
  const admin = await Admin.findById(id);
  if (!admin) {
    throw ApiError.notFound("Staff member not found.");
  }

  if (status === "ACTIVE") {
    admin.isActive = true;
    admin.lockUntil = undefined;
    admin.loginAttempts = 0;
  } else if (status === "INACTIVE") {
    admin.isActive = false;
    admin.lockUntil = undefined;
  } else if (status === "LOCKED") {
    admin.isActive = true;
    admin.loginAttempts = 5;
    admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  }

  await admin.save();

  const isLocked = !!(admin.lockUntil && new Date(admin.lockUntil) > new Date());

  return {
    _id: admin._id.toString(),
    status: isLocked ? "LOCKED" : admin.isActive ? "ACTIVE" : "INACTIVE",
    lockUntil: admin.lockUntil ? admin.lockUntil.toISOString() : null,
  };
};
export const deleteStaffService = async (id: string) => {
  const admin = await Admin.findById(id);
  if (!admin) throw new ApiError(404, "Staff member not found.");
  if (admin.role === "superadmin") {
    const superAdminCount = await Admin.countDocuments({ role: "superadmin" });
    if (superAdminCount <= 1) throw new ApiError(400, "Cannot delete the last Super Admin account.");
  }
  await Admin.findByIdAndDelete(id);
  return { deleted: true };
};
