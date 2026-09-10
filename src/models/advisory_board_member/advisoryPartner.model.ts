import mongoose, { Schema, Document } from "mongoose";

export interface IAdvisoryPartner extends Document {
  partners?: Array<{
    tagline?: string;
    image?: string;
    alt?: string;
    isImage?: boolean;
    text?: string;
  }>;
}

const AdvisoryPartnerSchema = new Schema<IAdvisoryPartner>(
  {
    partners: [
      {
        tagline: { type: String },
        image: { type: String },
        alt: { type: String },
        isImage: { type: Boolean },
        text: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IAdvisoryPartner>("AdvisoryPartner", AdvisoryPartnerSchema);
