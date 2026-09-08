import { Admin } from "../src/models/Admin.model";
import { connectDB } from "../src/config/db";

async function seed() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    let admin = await Admin.findOne({ email: "admin@bharatorganic.com" });

    if (admin) {
      admin.password = "Admin@12345"; // Mongoose pre("save") will hash it once!
      admin.loginAttempts = 0;
      admin.lockUntil = undefined;
      admin.isActive = true;
      admin.isTwoFactorEnabled = false;
      await admin.save();
      console.log("Updated Super Admin password to: Admin@12345 (2FA reset to false)");
    } else {
      admin = await Admin.create({
        name: "Super Admin",
        email: "admin@bharatorganic.com",
        phone: "+91 9876543210",
        employeeId: "EMP-0001",
        password: "Admin@12345", // Mongoose pre("save") will hash it once!
        role: "superadmin",
        isTwoFactorEnabled: false,
        isActive: true,
      });
      console.log("Created Super Admin:", admin.email);
    }

    // Verify password locally right now
    const testAdmin = await Admin.findOne({ email: "admin@bharatorganic.com" }).select("+password");
    const matches = await testAdmin?.comparePassword("Admin@12345");
    console.log("Verification check: password matches Admin@12345?", matches);

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
