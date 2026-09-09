import mongoose, { Schema } from "mongoose";

const aboutFaqSchema = new Schema({
    tagline: { type: String, default: '' },
    titlePart1: { type: String, default: '' },
    titlePart2: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    faqs: [{
        question: { type: String, default: '' },
        answer: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutFaq = mongoose.model("OrganicAboutFaq", aboutFaqSchema);
export default AboutFaq;
