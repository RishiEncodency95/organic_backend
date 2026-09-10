import mongoose, { Schema } from "mongoose";

const homeAboutSchema = new Schema({
    tagline: { type: String, default: '' },
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    secondaryImage: { type: String, default: '' },
    paragraphs: [{
        boldLead: { type: String, default: '' },
        text: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const HomeAbout = mongoose.model("OrganicHomeAbout", homeAboutSchema);
export default HomeAbout;
