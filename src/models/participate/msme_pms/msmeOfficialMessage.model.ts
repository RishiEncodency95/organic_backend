import mongoose, { Schema } from "mongoose";

const msmeOfficialMessageSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "Hear From MSME Leadership" },
    title: { type: String, default: "Official Message From MSME Director" },
    subtitle: {
      type: String,
      default:
        "A message of support and encouragement for all MSMEs participating in Bharat Organic Expo 2027 under the PMS Scheme.",
    },
    messageTitle: { type: String, default: "Message From MSME Leadership" },
    quote: {
      type: String,
      default:
        "Government of India is committed to empowering MSMEs and creating more opportunities for their growth. We appreciate initiatives like Bharat Organic Expo 2027 that provide a strong platform for MSMEs to showcase their products, build business, and expand globally.",
    },
    authorName: { type: String, default: "Shri. S. C. L. Das" },
    authorDesignation: {
      type: String,
      default:
        "Development Commissioner (MSME), Ministry of Micro, Small & Medium Enterprises, Government of India",
    },
    // A YouTube link, an Instagram post/reel link, or an uploaded (Cloudinary) video URL.
    videoUrl: { type: String, default: "https://www.youtube.com/watch?v=0DQ71A1CnOw" },
    // Optional custom cover shown before the video plays (overrides the auto thumbnail).
    thumbnailImage: { type: String, default: "" },
    thumbnailAlt: { type: String, default: "" },
  },
  { timestamps: true }
);

const MsmeOfficialMessage = mongoose.model(
  "OrganicMsmeOfficialMessage",
  msmeOfficialMessageSchema
);
export default MsmeOfficialMessage;
