import { Admin } from "../src/models/Admin.model";
import { connectDB } from "../src/config/db";

async function seed() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const usersToSeed = [
      {
        email: "somfrontenddeveloper@gmail.com",
        password: "12345678",
        name: "Som Frontend Developer",
        role: "superadmin" as const,
      },
      {
        email: "admin@bharatorganic.com",
        password: "Admin@12345",
        name: "Super Admin",
        role: "superadmin" as const,
      },
    ];

    for (const u of usersToSeed) {
      let admin = await Admin.findOne({ email: u.email });
      if (admin) {
        admin.password = u.password;
        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
        admin.isActive = true;
        admin.isTwoFactorEnabled = false;
        admin.role = u.role;
        await admin.save();
        console.log(`Updated user: ${u.email}`);
      } else {
        admin = await Admin.create({
          name: u.name,
          email: u.email,
          phone: "+91 9876543210",
          employeeId: "EMP-0002",
          password: u.password,
          role: u.role,
          isTwoFactorEnabled: false,
          isActive: true,
        });
        console.log(`Created user: ${u.email}`);
      }

      const testAdmin = await Admin.findOne({ email: u.email }).select("+password");
      const matches = await testAdmin?.comparePassword(u.password);
      console.log(`Verification check: ${u.email} password matches?`, matches);
    }

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
