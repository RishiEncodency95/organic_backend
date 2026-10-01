import mongoose, { Schema } from "mongoose";

// One document per website chat session (Organic Mitra chatbot).
const chatMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true, trim: true },
    pageUrl: { type: String, default: "", trim: true },
    // Details the visitor fills in before the chat starts
    lead: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true, index: true },
    },
    enquiryId: { type: Schema.Types.ObjectId, ref: "OrganicContactEnquiry" },
    whatsappSentAt: { type: Date },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

const Chat = mongoose.model("OrganicChat", chatSchema);
export default Chat;
