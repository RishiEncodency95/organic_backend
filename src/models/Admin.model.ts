import mongoose, { Document, Schema } from "mongoose";
import argon2 from "argon2";

export interface IAdmin extends Document {
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  avatarUrl?: string;
  password: string;
  role: "superadmin" | "admin";
  roleId?: string;
  roleName?: string;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  loginAttempts: number;
  lockUntil?: Date;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(password: string): Promise<boolean>;
  isLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name too long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Exclude password field from query results by default
    },
    role: {
      type: String,
      enum: ["superadmin", "admin"],
      default: "admin",
    },
    roleId: {
      type: String,
      trim: true,
    },
    roleName: {
      type: String,
      trim: true,
    },
    twoFactorSecret: {
      type: String,
      select: false, // Exclude 2FA secret from query results by default
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret: Record<string, any>) {
        delete ret.password;
        delete ret.twoFactorSecret;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Password hash hook
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await argon2.hash(this.password, {
    type: argon2.argon2id,     // Argon2id algorithm
    memoryCost: 2 ** 16,       // 64MB memory
    timeCost: 3,               // 3 iterations
    parallelism: 1,
  });
});

// Compare password
adminSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return argon2.verify(this.password, password);
};

// Check if account is currently locked
adminSchema.methods.isLocked = function (): boolean {
  if (this.lockUntil && new Date(this.lockUntil) <= new Date()) {
    return false;
  }
  return !!(this.lockUntil && new Date(this.lockUntil) > new Date());
};

// Increment failed login attempts
adminSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  // If previous lock has expired, reset counter first
  if (this.lockUntil && new Date(this.lockUntil) <= new Date()) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
  }

  this.loginAttempts = (this.loginAttempts || 0) + 1;

  if (this.loginAttempts >= MAX_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION);
  }

  await this.save();
};

// Reset login attempts on successful login
adminSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = new Date();
  await this.save();
};

export const Admin = mongoose.model<IAdmin>("Admin", adminSchema);
