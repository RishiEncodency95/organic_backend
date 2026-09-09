import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogSlugBottomBanner extends Document {
    [key: string]: any;
}

const BlogSlugBottomBannerSchema: Schema = new Schema({

    banners: [{
        icon: { type: String },
        label: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogSlugBottomBanner>('BlogSlugBottomBanner', BlogSlugBottomBannerSchema);
