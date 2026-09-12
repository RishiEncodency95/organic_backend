import mongoose, { Schema } from "mongoose";

const documentItemSchema = new Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    isRequired: { type: Boolean, default: true },
  },
  { _id: false }
);

const msmeDocumentsSchema = new Schema(
  {
    tagline: { type: String, default: "DOCUMENTATION CHECKLIST" },
    title: { type: String, default: "Documents Required for PMS Application" },
    subtitle: {
      type: String,
      default: "Ensure you have the following documents ready before submitting your PMS reimbursement claim.",
    },
    documents: {
      type: [documentItemSchema],
      default: [
        {
          title: "Udyam Registration Certificate",
          description: "Valid Udyam Certificate showing Micro or Small Enterprise status.",
          isRequired: true,
        },
        {
          title: "PAN & GST Certificate",
          description: "Permanent Account Number and GST registration of the enterprise.",
          isRequired: true,
        },
        {
          title: "Stall Allotment Letter & Invoices",
          description: "Copy of stall allotment letter, space rent invoices and payment receipts.",
          isRequired: true,
        },
        {
          title: "Bank Account Details (Cancelled Cheque)",
          description: "Bank account details linked with Udyam for direct benefit transfer (DBT).",
          isRequired: true,
        },
        {
          title: "Self-Declaration / Application Form",
          description: "Duly signed PMS Scheme application form and self-declaration.",
          isRequired: true,
        },
      ],
    },
    checklistPdfUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

const MsmeDocuments = mongoose.model("OrganicMsmeDocuments", msmeDocumentsSchema);
export default MsmeDocuments;
