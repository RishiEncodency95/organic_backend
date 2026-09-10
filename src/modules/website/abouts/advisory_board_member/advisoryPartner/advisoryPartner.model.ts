import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvisoryPartner extends Document {
    [key: string]: any;
}

const AdvisoryPartnerSchema: Schema = new Schema({

    partners: [{
        tagline: { type: String },
        image: { type: String },
        alt: { type: String },
        isImage: { type: Boolean },
        text: { type: String }
    }]
}, { timestamps: true });

export default mongoose.model<IAdvisoryPartner>('AdvisoryPartner', AdvisoryPartnerSchema);
