import mongoose, { Document, Schema } from "mongoose";

export interface IGalleryCounterItem {
  id?: number | string;
  val: string;
  label: string;
  icon?: string;
  image?: string;
}

export interface IGalleryCounters extends Document {
  enabled: boolean;
  title: string;
  items: IGalleryCounterItem[];
  createdAt: Date;
  updatedAt: Date;
}

const galleryCounterItemSchema = new Schema<IGalleryCounterItem>(
  {
    id: { type: Schema.Types.Mixed },
    val: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: "Users" },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const galleryCountersSchema = new Schema<IGalleryCounters>(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "EXPO IMPACT IN NUMBERS", trim: true },
    items: { type: [galleryCounterItemSchema], default: [] },
  },
  { timestamps: true }
);

const GalleryCounters = mongoose.model<IGalleryCounters>("GalleryCounters", galleryCountersSchema);
export default GalleryCounters;
