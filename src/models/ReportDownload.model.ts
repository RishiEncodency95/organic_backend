import mongoose, { Schema } from "mongoose";

/** Opaque, expiring, limited-use download ids for the Excel report (only a hash of the id is stored). */
const schema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  usesLeft: { type: Number, default: 3 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

const ReportDownload = mongoose.models.ReportDownload || mongoose.model("ReportDownload", schema);
export default ReportDownload;
