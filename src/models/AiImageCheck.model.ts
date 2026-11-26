import mongoose, { Document, Schema } from "mongoose";

/**
 * The result of checking one picture for signs that it was made by AI, kept per picture file (by the SHA-256 of its
 * bytes) so the same picture is never sent to the AI model twice. Two separate kinds of answer are stored:
 *   - metadata: proof written inside the file (C2PA content credentials, IPTC "trained algorithmic media", the name
 *     of an AI generator). When present it is a fact.
 *   - vision: an AI model's estimate from looking at the picture (0-100). It is an estimate, never proof.
 */
export interface IAiImageCheck extends Document {
  sha256: string;
  /** Where the picture was last seen (for reference only; the hash is the key) */
  src: string;
  bytes: number;
  contentType: string;
  metadataSignals: string[];
  /** The file itself says it was made by AI (not just that it carries Content Credentials) */
  provenAi: boolean;
  /** Which version of the vision question produced visionLikelihood; answers from older versions are not trusted */
  visionVersion: number;
  visionLikelihood: number | null;
  visionKind: string | null;
  visionReasons: string[];
  visionModel: string | null;
  visionError: string | null;
  checkedAt: Date;
}

const schema = new Schema<IAiImageCheck>(
  {
    sha256: { type: String, required: true, unique: true, index: true },
    src: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    contentType: { type: String, default: "" },
    metadataSignals: { type: [String], default: [] },
    provenAi: { type: Boolean, default: false },
    visionVersion: { type: Number, default: 0 },
    visionLikelihood: { type: Number, default: null },
    visionKind: { type: String, default: null },
    visionReasons: { type: [String], default: [] },
    visionModel: { type: String, default: null },
    visionError: { type: String, default: null },
    checkedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

const AiImageCheck = mongoose.models.AiImageCheck || mongoose.model<IAiImageCheck>("AiImageCheck", schema);
export default AiImageCheck;
