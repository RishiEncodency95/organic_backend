import mongoose, { Document, Schema } from "mongoose";

const logoSchema = new Schema({
  image: { type: String, default: '' },
  imageAlt: { type: String, default: '' }
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
