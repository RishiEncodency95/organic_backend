import mongoose, { Schema } from "mongoose";

const aboutHeroSchema = new Schema({
    tagline: { type: String, default: '' },
    titlePart1: { type: String, default: '' },
    titlePart2: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    buttons: [{
        label: { type: String, default: '' },
        link: { type: String, default: '' },
        style: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutHero = mongoose.model("OrganicAboutHero", aboutHeroSchema);
export default AboutHero;
