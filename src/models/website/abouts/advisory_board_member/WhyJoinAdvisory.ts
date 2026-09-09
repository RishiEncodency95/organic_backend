import mongoose, { Schema, Document } from 'mongoose';

export interface IWhyJoinAdvisory extends Document {
    [key: string]: any;
}

const WhyJoinAdvisorySchema: Schema = new Schema({

    topSection: {
        tagline: { type: String },
        title: { type: String },
        description: { type: String }
    },
    bottomSection: {
        tagline: { type: String },
        titlePart1: { type: String },
        titlePart2: { type: String },
        description: { type: String },
        features: [{
            iconPath: { type: String },
            isSvgRaw: { type: Boolean },
            titlePart1: { type: String },
            titlePart2: { type: String },
            icon: { type: String }
        }],
        buttonText: { type: String },
        buttonLink: { type: String }
    },
    benefits: [{
        icon: { type: String },
        title: { type: String },
        description: { type: String },
        color: { type: String },
        bgLight: { type: String },
        borderColor: { type: String },
        borderBottom: { type: String },
        hoverShadow: { type: String },
        hoverBg: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IWhyJoinAdvisory>('WhyJoinAdvisory', WhyJoinAdvisorySchema);
