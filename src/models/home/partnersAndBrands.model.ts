import mongoose, { Document, Schema } from "mongoose";

const logoSchema = new Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, default: "" },
  image: { type: String, default: "" },
  imageAlt: { type: String, default: "" },
  category: { type: String, default: "" },
  order: { type: Number, default: 0 },
  status: { type: String, default: "Published" },
  updatedBy: { type: String, default: "Admin" },
  updatedAt: { type: String, default: "" },
  fileSize: { type: String, default: "" },
}, { _id: false });

const partnersAndBrandsSchema = new Schema({
  industryLeadersLogos: { type: [logoSchema], default: [] },
  knowledgeLogos: { type: [logoSchema], default: [] },
  wellnessLogos: { type: [logoSchema], default: [] },
  supportingLogos: { type: [logoSchema], default: [] },
  emergingBrandsLogos: { type: [logoSchema], default: [] }
}, { timestamps: true });

const PartnersAndBrands = mongoose.model("OrganicPartnersAndBrands", partnersAndBrandsSchema);
export default PartnersAndBrands;
