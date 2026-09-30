import mongoose, { Schema } from "mongoose";

const fourPillarsSchema = new Schema({
    eyebrow: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    pillars: [{
        // Older documents stored the title as a two-line string array; new saves send a single string.
        title: { type: Schema.Types.Mixed, default: '' },
        subtitle: { type: String, default: '' },
        themeColor: { type: String, default: '' },
        desc: { type: String, default: '' },
        icon: { type: String, default: '' },
        img: { type: String, default: '' },
        imgAlt: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const FourPillars = mongoose.model("OrganicFourPillars", fourPillarsSchema);
export default FourPillars;
