import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogVideos extends Document {
    [key: string]: any;
}

const BlogVideosSchema: Schema = new Schema({

    title: { type: String },
    actionText: { type: String },
    videos: [{
        img: { type: String },
        title: { type: String },
        duration: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogVideos>('BlogVideos', BlogVideosSchema);
