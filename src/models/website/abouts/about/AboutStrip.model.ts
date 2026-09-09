import mongoose, { Schema } from "mongoose";

const aboutStripSchema = new Schema({
    items: [{
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        icon: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutStrip = mongoose.model("OrganicAboutStrip", aboutStripSchema);
export default AboutStrip;
