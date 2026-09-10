import mongoose, { Schema, Document } from 'mongoose';

export interface IBlogSlugArticle extends Document {
    [key: string]: any;
}

const BlogSlugArticleSchema: Schema = new Schema({

    breadcrumbs: [{
        label: { type: String },
        href: { type: String }
    }],
    category: { type: String },
    title: { type: String },
    description: { type: String },
    meta: {
        date: { type: String },
        readTime: { type: String },
        views: { type: String }
    },
    image: { type: String },
    paragraphs: [{ type: String }],
    sections: [{
        id: { type: Number },
        title: { type: String },
        content: { type: String },
        type: { type: String }, // "stats", "list", "cards", "quote"
        statsData: [{
            icon: { type: String },
            value: { type: String },
            label: { type: String }
        }],
        listData: [{
            title: { type: String },
            desc: { type: String }
        }],
        cardsData: [{
            icon: { type: String },
            title: { type: String },
            desc: { type: String }
        }],
        quoteData: {
            main: { type: String },
            sub: { type: String }
        }
    }]
}, { timestamps: true });

export default mongoose.model<IBlogSlugArticle>('BlogSlugArticle', BlogSlugArticleSchema);
