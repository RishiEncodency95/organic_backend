import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogLatest extends Document {
    [key: string]: any;
}

const BlogLatestSchema: Schema = new Schema({

    title: { type: String },
    actionText: { type: String },
    updates: [{
        tag: { type: String },
        img: { type: String },
        title: { type: String },
        desc: { type: String },
        date: { type: String },
        read: { type: String },
        link: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogLatest>('BlogLatest', BlogLatestSchema);
