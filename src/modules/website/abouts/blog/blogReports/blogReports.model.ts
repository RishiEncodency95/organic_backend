import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogReports extends Document {
    [key: string]: any;
}

const BlogReportsSchema: Schema = new Schema({

    title: { type: String },
    actionText: { type: String },
    reports: [{
        title: { type: String },
        meta: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogReports>('BlogReports', BlogReportsSchema);
