import mongoose, { Schema, Document } from "mongoose";

export interface IBlogExperts extends Document {
  title?: string;
  actionText?: string;
  experts?: Array<{
    name?: string;
    role?: string;
    quote?: string;
    img?: string;
  }>;
}

const BlogExpertsSchema = new Schema<IBlogExperts>(
  {
    title: { type: String },
    actionText: { type: String },
    experts: [
      {
        name: { type: String },
        role: { type: String },
        quote: { type: String },
        img: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogExperts>("BlogExperts", BlogExpertsSchema);
