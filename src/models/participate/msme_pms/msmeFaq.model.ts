import mongoose, { Schema } from "mongoose";

const faqItemSchema = new Schema(
  {
    question: { type: String, default: "" },
    answer: { type: String, default: "" },
    category: { type: String, default: "General" },
  },
  { _id: false }
);

const msmeFaqSchema = new Schema(
  {
    tagline: { type: String, default: "FREQUENTLY ASKED QUESTIONS" },
    title: { type: String, default: "Everything You Need to Know About PMS Support" },
    faqs: {
      type: [faqItemSchema],
      default: [
        {
          question: "Who is eligible for PMS Scheme assistance?",
          answer:
            "Micro and Small Enterprises (MSEs) with a valid Udyam Registration engaged in manufacturing or services related to organic, natural, and agricultural products are eligible as per MoMSME guidelines.",
          category: "Eligibility",
        },
        {
          question: "How much space rent reimbursement can I claim?",
          answer:
            "General category MSEs can claim up to 80% of space rent, while SC/ST/Women/NER/PH category MSEs can claim up to 100% of space rent, subject to maximum scheme ceilings.",
          category: "Financials",
        },
        {
          question: "When is the reimbursement amount disbursed?",
          answer:
            "Reimbursement claims are submitted post-event along with required proof of participation and bills. Once processed by the competent authority, funds are transferred via DBT directly to your bank account.",
          category: "Process",
        },
        {
          question: "How do I check if my Udyam certificate qualifies?",
          answer:
            "You can use our online PMS Eligibility Check tool or consult our dedicated Relationship Managers for document verification.",
          category: "Eligibility",
        },
      ],
    },
  },
  { timestamps: true }
);

const MsmeFaq = mongoose.model("OrganicMsmeFaq", msmeFaqSchema);
export default MsmeFaq;
