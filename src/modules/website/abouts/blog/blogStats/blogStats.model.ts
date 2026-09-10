import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogStats extends Document {
    [key: string]: any;
}

const BlogStatsSchema: Schema = new Schema({

    stats: [{
        icon: { type: String },
        value: { type: Number },
        suffix: { type: String },
        label: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogStats>('BlogStats', BlogStatsSchema);
