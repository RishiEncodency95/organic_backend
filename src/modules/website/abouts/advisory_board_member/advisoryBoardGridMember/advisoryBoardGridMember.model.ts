import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvisoryBoardGridMember extends Document {
    [key: string]: any;
}

const AdvisoryBoardGridMemberSchema: Schema = new Schema({

    name: { type: String },
    designation: { type: String },
    organization: { type: String },
    location: { type: String },
    image: { type: String }
}, { timestamps: true });

export default mongoose.model<IAdvisoryBoardGridMember>('AdvisoryBoardGridMember', AdvisoryBoardGridMemberSchema);
