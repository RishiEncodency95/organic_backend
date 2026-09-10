import mongoose, { Schema, Document } from 'mongoose';

export interface IChairmanMessage extends Document {
    [key: string]: any;
}

const ChairmanMessageSchema: Schema = new Schema({

    tagline: { type: String },
    titlePart1: { type: String },
    titlePart2: { type: String },
    paragraphs: [{
        text: { type: String },
        strongText: { type: String },
        textAfter: { type: String }
    }],
    name: { type: String },
    title: { type: String },
    visionTagline: { type: String },
    visionText: { type: String }
}, { timestamps: true });

export default mongoose.model<IChairmanMessage>('ChairmanMessage', ChairmanMessageSchema);
