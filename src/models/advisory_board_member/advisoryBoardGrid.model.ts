import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvisoryBoardGrid extends Document {
    [key: string]: any;
}

const AdvisoryBoardGridSchema: Schema = new Schema({
    tagline: { type: String },
    title: { type: String }
}, { timestamps: true });

export default mongoose.model<IAdvisoryBoardGrid>('AdvisoryBoardGrid', AdvisoryBoardGridSchema);
