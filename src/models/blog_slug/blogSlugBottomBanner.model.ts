import mongoose, { Schema, Document } from "mongoose";

export interface IBlogSlugBottomBanner extends Document {
  banners?: Array<{
    icon?: string;
    label?: string;
  }>;
}

const BlogSlugBottomBannerSchema = new Schema<IBlogSlugBottomBanner>(
  {
    banners: [
      {
        icon: { type: String },
        label: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogSlugBottomBanner>("BlogSlugBottomBanner", BlogSlugBottomBannerSchema);
