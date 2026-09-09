import mongoose, { Schema, Document } from 'mongoose';

export interface INominateBanner extends Document {
    [key: string]: any;
}

const NominateBannerSchema: Schema = new Schema({

    tagline: { type: String },
    titlePart1: { type: String },
    titlePart2: { type: String },
    description: { type: String },
    features: [{
        icon: { type: String },
        titlePart1: { type: String },
        titlePart2: { type: String }
    }],
    buttonText: { type: String },
    buttonLink: { type: String }
}, { timestamps: true });

export default mongoose.model<INominateBanner>('NominateBanner', NominateBannerSchema);
