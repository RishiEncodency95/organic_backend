import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogExperts extends Document {
    [key: string]: any;
}

const BlogExpertsSchema: Schema = new Schema({

    title: { type: String },
    actionText: { type: String },
    experts: [{
        name: { type: String },
        role: { type: String },
        quote: { type: String },
        img: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogExperts>('BlogExperts', BlogExpertsSchema);
