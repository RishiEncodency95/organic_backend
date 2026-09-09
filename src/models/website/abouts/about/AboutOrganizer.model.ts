import mongoose, { Schema } from "mongoose";

const aboutOrganizerSchema = new Schema({
    about: {
        tagline: { type: String, default: '' },
        title: { type: String, default: '' },
        paragraphs: [{ type: String }],
        capabilitiesTitle: { type: String, default: '' },
        capabilities: [{ type: String }]
    },
    badge: {
        number: { type: String, default: '' },
        text: { type: String, default: '' }
    },
    journey: {
        tagline: { type: String, default: '' },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        timeline: {
            title: { type: String, default: '' },
            events: [{
                year: { type: String, default: '' },
                text: { type: String, default: '' }
            }]
        },
        sectors: {
            title: { type: String, default: '' },
            items: [{
                label: { type: String, default: '' },
                text: { type: String, default: '' }
            }]
        },
        flagship: {
            title: { type: String, default: '' },
            desc: { type: String, default: '' },
            events: [{ type: String }]
        }
    },
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutOrganizer = mongoose.model("OrganicAboutOrganizer", aboutOrganizerSchema);
export default AboutOrganizer;
