import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogSidebar extends Document {
    [key: string]: any;
}

const BlogSidebarSchema: Schema = new Schema({

    categoriesTitle: { type: String },
    viewAllCategoriesText: { type: String },
    categories: [{
        icon: { type: String },
        label: { type: String },
        count: { type: Number },
        color: { type: String }
    }],
    newsletter: {
        title: { type: String },
        description: { type: String },
        inputPlaceholder: { type: String },
        buttonText: { type: String },
        subscribedText: { type: String },
        footerText: { type: String }
    }
}, { timestamps: true });

export default mongoose.model<IBlogSidebar>('BlogSidebar', BlogSidebarSchema);
