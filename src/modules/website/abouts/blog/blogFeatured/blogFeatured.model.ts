import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogFeatured extends Document {
    [key: string]: any;
}

const BlogFeaturedSchema: Schema = new Schema({

    title: { type: String },
    actionText: { type: String },
    articles: [{
        tag: { type: String },
        img: { type: String },
        title: { type: String },
        desc: { type: String },
        date: { type: String },
        read: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogFeatured>('BlogFeatured', BlogFeaturedSchema);
