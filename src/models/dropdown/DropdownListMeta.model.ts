import mongoose, { Schema, Document } from "mongoose";

/**
 * Who last changed a website dropdown's options, and when. One row per list key,
 * written whenever an admin adds, edits, shows / hides, deletes or reorders an option.
 */
export interface IDropdownListMeta extends Document {
  list: string;
  updatedBy: string;
  updatedById?: string;
  updatedAt: Date;
}

const DropdownListMetaSchema: Schema = new Schema({
  list: { type: String, required: true, trim: true, unique: true },
  updatedBy: { type: String, required: true, trim: true },
  updatedById: { type: String },
  updatedAt: { type: Date, required: true },
});

export default mongoose.models.DropdownListMeta ||
  mongoose.model<IDropdownListMeta>("DropdownListMeta", DropdownListMetaSchema);
