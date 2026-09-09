import mongoose, { Schema } from "mongoose";

const fourPillarsSchema = new Schema({
    title: { type: String, default: '' },
    pillars: [{
        title: [{ type: String }],
        themeColor: { type: String, default: '' },
        desc: { type: String, default: '' },
        icon: { type: String, default: '' },
        img: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const FourPillars = mongoose.model("OrganicFourPillars", fourPillarsSchema);
export default FourPillars;
