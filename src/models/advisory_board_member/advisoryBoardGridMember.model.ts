import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvisoryBoardGridMember extends Document {
    [key: string]: any;
}

const AdvisoryBoardGridMemberSchema: Schema = new Schema({
    name: { type: String, default: "" },
    designation: { type: String, default: "" },
    organization: { type: String, default: "" },
    location: { type: String, default: "India" },
    image: { type: String, default: "" },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["Published", "Draft"], default: "Published" },
    updatedBy: { type: String, default: "Super Admin" },
    fileSize: { type: String, default: "15.0 KB" },
    websiteUrl: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model<IAdvisoryBoardGridMember>('AdvisoryBoardGridMember', AdvisoryBoardGridMemberSchema);
