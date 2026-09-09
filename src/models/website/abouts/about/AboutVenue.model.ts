import mongoose, { Schema } from "mongoose";

const aboutVenueSchema = new Schema({
    tagline: { type: String, default: '' },
    title: { type: String, default: '' },
    hallBadge: { type: String, default: '' },
    locationBadge: { type: String, default: '' },
    features: [{
        color: { type: String, default: '' },
        bg: { type: String, default: '' },
        text: { type: String, default: '' },
        icon: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutVenue = mongoose.model("OrganicAboutVenue", aboutVenueSchema);
export default AboutVenue;
