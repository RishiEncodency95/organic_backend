import mongoose, { Schema } from "mongoose";

const visionMissionSchema = new Schema({
    vision: {
        tagline: { type: String, default: '' },
        title: { type: String, default: '' },
        paragraphs: [{
            text: { type: String, default: '' },
            strongText: { type: String, default: '' },
            textAfter: { type: String, default: '' }
        }]
    },
    mission: {
        tagline: { type: String, default: '' },
        title: { type: String, default: '' },
        paragraphs: [{
            text: { type: String, default: '' },
            strongText: { type: String, default: '' },
            textAfter: { type: String, default: '' }
        }]
    },
    status: { type: String, default: 'active' }
}, { timestamps: true });

const VisionMission = mongoose.model("OrganicVisionMission", visionMissionSchema);
export default VisionMission;
