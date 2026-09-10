import mongoose, { Schema } from "mongoose";

const eventOverviewSchema = new Schema({
    tagline: { type: String, default: '' },
    title: { type: String, default: '' },
    paragraphs: [{
        boldLead: { type: String, default: '' },
        text: { type: String, default: '' },
        inlineBold1: { type: String, default: '' },
        text2: { type: String, default: '' },
        inlineBold2: { type: String, default: '' },
        text3: { type: String, default: '' }
    }],
    sectorsTitle: { type: String, default: '' },
    sectors: [{
        label: { type: String, default: '' },
        color: { type: String, default: '' },
        icon: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const EventOverview = mongoose.model("OrganicEventOverview", eventOverviewSchema);
export default EventOverview;
