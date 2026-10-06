import mongoose, { Schema } from "mongoose";

// One document per website chat session (Organic Mitra chatbot).
const chatMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    // Assistant reply that had no answer in the knowledge — listed in the manager's Review Queue
    needsReview: { type: Boolean },
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
      email: { type: String, trim: true, lowercase: true, index: true },
      phone: { type: String, trim: true, index: true },
    },
    enquiryId: { type: Schema.Types.ObjectId, ref: "OrganicContactEnquiry" },
    // Quotation / callback requests made from the chat's forms
    requests: {
      type: [
        new Schema(
          {
            type: { type: String, enum: ["stall-quotation", "sales-callback"], required: true },
            stallSize: { type: String, trim: true },
            company: { type: String, trim: true },
            preferredTime: { type: String, trim: true },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    whatsappSentAt: { type: Date },
    // Who is chatting before the details form: saved under the visitor's IP ("Visitor 103.x.x.x")
    // until the mobile number is verified, then `lead` carries the real name and number.
    visitorName: { type: String, trim: true },
    visitor: {
      ip: { type: String, trim: true, index: true },
      userAgent: { type: String, trim: true },
    },
    // Set once the mobile number in `lead` is verified with the WhatsApp OTP
    phoneVerifiedAt: { type: Date },
    // 👍 / 👎 on the "Chat ended" screen
    feedback: { type: String, enum: ["yes", "no"] },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

const Chat = mongoose.model("OrganicChat", chatSchema);
export default Chat;
