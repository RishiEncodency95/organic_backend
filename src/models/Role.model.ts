import mongoose, { Document, Schema } from "mongoose";

export interface IRole extends Document {
  name: string;
  slug: string;
  description?: string;
  permissionIds: string[];
  isSystem: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      maxlength: [60, "Role name too long"],
    },
    slug: {
      type: String,
      required: [true, "Role slug is required"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9_]+$/, "Role slug must contain only uppercase letters, numbers and underscores"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [250, "Description too long"],
    },
    permissionIds: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

export const Role = mongoose.model<IRole>("Role", roleSchema);
