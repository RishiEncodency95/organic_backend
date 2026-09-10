import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvisoryHero extends Document {
    [key: string]: any;
}

const AdvisoryHeroSchema: Schema = new Schema({

    titlePart1: { type: String },
    titlePart2: { type: String },
    subtitlePart1: { type: String },
    subtitlePart2: { type: String },
    description: { type: String },
    image: { type: String },
    imageAlt: { type: String },
    secondaryImage: { type: String },
    features: [{
        icon: { type: String },
        titlePart1: { type: String },
        titlePart2: { type: String },
        descPart1: { type: String },
        descPart2: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IAdvisoryHero>('AdvisoryHero', AdvisoryHeroSchema);
