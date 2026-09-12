import mongoose, { Schema } from "mongoose";

const msmeOfficialMessageSchema = new Schema(
  {
    eyebrow: { type: String, default: "Hear From MSME Leadership" },
    titlePrefix: { type: String, default: "Official Message " },
    titleHighlight: { type: String, default: "From MSME Director" },
    subtitle: {
      type: String,
      default:
        "A message of support and encouragement for all MSMEs participating in Bharat Organic Expo 2027 under the PMS Scheme.",
    },
    directorName: { type: String, default: "MSME Leadership" },
    directorTitle: { type: String, default: "Director, Ministry of MSME" },
    messageQuote: {
      type: String,
      default:
        "We encourage all eligible Micro and Small Enterprises to leverage the PMS Scheme for expanding their market reach and displaying India's finest organic and natural innovations.",
    },
    youtubeVideoId: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

const MsmeOfficialMessage = mongoose.model(
  "OrganicMsmeOfficialMessage",
  msmeOfficialMessageSchema
);
export default MsmeOfficialMessage;
