import mongoose, { Schema } from "mongoose";

// Inbox & Leads values (admin chatbot/inbox)
export const INBOX_STATUSES = ["New", "In Progress", "Follow-up", "Assigned", "Waiting for Visitor", "Resolved"] as const;
export const INBOX_PRIORITIES = ["High", "Medium", "Low"] as const;
export const INBOX_CATEGORIES = ["lead", "enquiry", "support", "feedback", "complaint"] as const;

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
    // Questions answered by the AI; without a verified number only FREE_AI_QUESTIONS are allowed
    aiQuestions: { type: Number, default: 0 },
    // "manual": an enquiry the team added in Inbox & Leads (phone call, walk-in…), not a website chat
    source: { type: String, enum: ["chat", "manual"], default: "chat", index: true },
    manual: {
      channel: { type: String, trim: true },
      category: { type: String, enum: INBOX_CATEGORIES },
      type: { type: String, trim: true },
      topic: { type: String, trim: true },
      detail: { type: String, trim: true },
    },
    // Team follow-up from Inbox & Leads: owner, status, priority, next follow-up and its history
    workflow: {
      assignedTo: { type: String, trim: true },
      team: { type: String, trim: true },
      status: { type: String, enum: INBOX_STATUSES },
      priority: { type: String, enum: INBOX_PRIORITIES },
      followUpKind: { type: String, enum: ["date", "review", "assign", "none"] },
      followUpAt: { type: Date },
      resolvedAt: { type: Date },
      spam: { type: Boolean },
      // The visitor's messages up to here have been read in the inbox
      seenAt: { type: Date },
      updatedAt: { type: Date },
      updatedBy: { type: String, trim: true },
      // Notification Settings rule that routed it, and when its overdue handling ran
      rule: { type: String, trim: true },
      escalatedAt: { type: Date },
      activity: {
        type: [
          new Schema(
            {
              kind: { type: String, enum: ["reply", "note", "event"], required: true },
              text: { type: String, required: true },
              by: { type: String, trim: true },
              at: { type: Date, default: Date.now },
            },
            { _id: false }
          ),
        ],
        default: undefined,
      },
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model("OrganicChat", chatSchema);
export default Chat;
