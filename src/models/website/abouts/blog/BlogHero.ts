import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogHero extends Document {
    [key: string]: any;
}

const BlogHeroSchema: Schema = new Schema({

    tagline: { type: String },
    titlePart1: { type: String },
    titlePart2: { type: String },
    subtitle: { type: String },
    description: { type: String }
}, { timestamps: true });

export default mongoose.model<IBlogHero>('BlogHero', BlogHeroSchema);
