import mongoose, { Schema } from "mongoose";

const termsHeroSchema = new Schema({
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    buttonLabel: { type: String, default: '' },
    image: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
}, { timestamps: true });

const TermsHero = mongoose.model("OrganicTermsHero", termsHeroSchema);
export default TermsHero;
