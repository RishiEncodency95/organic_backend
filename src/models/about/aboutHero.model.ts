import mongoose, { Schema } from "mongoose";

const aboutHeroSchema = new Schema({
    tagline: { type: String, default: '' },
    // The About page H1. Replaces titlePart1 + titlePart2, which are kept only so older
    // saves can still be read (joined) until the admin saves the page again.
    title: { type: String, default: '' },
    titlePart1: { type: String, default: '' },
    titlePart2: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    secondaryImage: { type: String, default: '' },
    buttons: [{
        label: { type: String, default: '' },
        link: { type: String, default: '' },
        style: { type: String, default: '' }
    }],
    status: { type: String, default: 'active' }
}, { timestamps: true });

const AboutHero = mongoose.model("OrganicAboutHero", aboutHeroSchema);
export default AboutHero;
