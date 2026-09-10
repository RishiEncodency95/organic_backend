import mongoose, { Schema, Document } from "mongoose";

export interface IBlogCta extends Document {
  title?: string;
  description?: string;
  buttons?: Array<{
    text?: string;
    link?: string;
    styleClass?: string;
  }>;
  info?: Array<{
    icon?: string;
    text?: string;
  }>;
}

const BlogCtaSchema = new Schema<IBlogCta>(
  {
    title: { type: String },
    description: { type: String },
    buttons: [
      {
        text: { type: String },
        link: { type: String },
        styleClass: { type: String },
      },
    ],
    info: [
      {
        icon: { type: String },
        text: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogCta>("BlogCta", BlogCtaSchema);
