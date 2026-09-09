import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogSlugSidebar extends Document {
    [key: string]: any;
}

const BlogSlugSidebarSchema: Schema = new Schema({

    author: {
        name: { type: String },
        description: { type: String }
    },
    relatedArticles: [{
        title: { type: String },
        date: { type: String },
        image: { type: String }
    }],
    categories: [{
        name: { type: String },
        active: { type: Boolean }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogSlugSidebar>('BlogSlugSidebar', BlogSlugSidebarSchema);
