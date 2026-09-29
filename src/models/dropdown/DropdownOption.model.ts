import mongoose, { Schema, Document } from "mongoose";

/**
 * One option of an admin-managed website dropdown. Options are grouped by `list`
 * (a key from DROPDOWN_LISTS); `parentValue` ties an option to a value of its
 * list's parent list, e.g. a sub-category to its primary category.
 */
export interface IDropdownOption extends Document {
  list: string;
  label: string;
  value: string;
  parentValue: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DropdownOptionSchema: Schema = new Schema(
  {
    list: { type: String, required: true, trim: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    value: { type: String, required: true, trim: true, maxlength: 200 },
    parentValue: { type: String, default: "", trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// The same value may repeat under different parents, but never twice under one.
DropdownOptionSchema.index({ list: 1, parentValue: 1, value: 1 }, { unique: true });
DropdownOptionSchema.index({ list: 1, isActive: 1, order: 1 });

export default mongoose.models.DropdownOption ||
  mongoose.model<IDropdownOption>("DropdownOption", DropdownOptionSchema);
