import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogCta extends Document {
    [key: string]: any;
}

const BlogCtaSchema: Schema = new Schema({

    title: { type: String },
    description: { type: String },
    buttons: [{
        text: { type: String },
        link: { type: String },
        styleClass: { type: String }
    }],
    info: [{
        icon: { type: String },
        text: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogCta>('BlogCta', BlogCtaSchema);
