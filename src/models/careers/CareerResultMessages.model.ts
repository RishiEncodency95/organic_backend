import mongoose, { Schema } from "mongoose";

/**
 * Result messages edited in admin Career Settings → Result Messages. The web message is
 * shown on the careers eligibility result; email/SMS/WhatsApp templates are stored for
 * those channels. Text may use {{variables}} (see RESULT_MESSAGE_VARIABLES in the admin).
 */
export const RESULT_MESSAGE_TYPES = ["eligible", "partial", "notEligible", "incomplete"] as const;
export type ResultMessageType = (typeof RESULT_MESSAGE_TYPES)[number];

const SIGN_OFF = "\n\nBest regards,\nBharat Organic Expo Team";

// Defaults are the copy the website/admin showed before this was editable.
export const DEFAULT_RESULT_MESSAGES: Record<ResultMessageType, Record<string, any>> = {
  eligible: {
    active: true,
    title: "Great News, {{first_name}}!",
    subtitle: "You are eligible to apply for this position.",
    web: "Your profile meets the minimum requirements and shows a good alignment with what we are looking for. We encourage you to complete your application and join us in our mission for a healthier and more sustainable India.",
    email: `Dear {{candidate_name}},\n\nCongratulations! Based on your information, you appear to be eligible for the position "{{job_title}}" at Bharat Organic Expo.\n\nPlease complete and submit the application form to proceed further.${SIGN_OFF}`,
    sms: `Hi {{first_name}}, you appear eligible for "{{job_title}}" at Bharat Organic Expo. Complete your application: {{application_link}}`,
    whatsapp: `Hi {{first_name}} 👋\n\nGreat news! You appear to be eligible for *{{job_title}}* at Bharat Organic Expo.\n\nComplete your application here: {{application_link}}`,
  },
  partial: {
    active: true,
    title: "Good Start, {{first_name}}!",
    subtitle: "You are close to the requirements for this position.",
    web: "Your profile shows good potential, but a few key areas need improvement. You can still apply after reviewing the suggestions below and updating your profile or CV to strengthen your application.",
    email: `Dear {{candidate_name}},\n\nThank you for your interest in "{{job_title}}". Your profile matches several key requirements, and a few areas could be strengthened. You can still complete and submit your application.${SIGN_OFF}`,
    sms: `Hi {{first_name}}, you're close to the requirements for "{{job_title}}". You can still apply: {{application_link}}`,
    whatsapp: `Hi {{first_name}},\n\nYou're close to the requirements for *{{job_title}}*. You can still apply here: {{application_link}}`,
  },
  notEligible: {
    active: true,
    title: "Thank You, {{first_name}}!",
    subtitle: "This position may not be the right fit for you at this time.",
    web: "Your profile does not meet the minimum requirements for this role. We appreciate your interest and encourage you to explore other opportunities that better match your skills.",
    email: `Dear {{candidate_name}},\n\nThank you for your interest in "{{job_title}}".\n\nBased on the information provided, you do not meet the eligibility criteria for this position at this time. We encourage you to explore other opportunities with us in the future.${SIGN_OFF}`,
    sms: `Hi {{first_name}}, thank you for your interest in "{{job_title}}". This role isn't the right fit right now — please explore our other openings.`,
    whatsapp: `Hi {{first_name}},\n\nThank you for your interest in *{{job_title}}*. This role isn't the right fit right now, but we encourage you to explore our other openings.`,
  },
  incomplete: {
    active: true,
    title: "Your Application Is Incomplete",
    subtitle: "",
    web: `Your application for "{{job_title}}" is incomplete. Please provide the missing details to submit your application.`,
    email: `Dear {{candidate_name}},\n\nYour application for "{{job_title}}" is incomplete.\n\nPlease provide the missing details to submit your application. You can continue from where you left off by clicking the link below.\n\n{{application_link}}${SIGN_OFF}`,
    sms: `Hi {{first_name}}, your application for "{{job_title}}" is incomplete. Continue here: {{application_link}}`,
    whatsapp: `Hi {{first_name}},\n\nYour application for *{{job_title}}* is incomplete. Continue where you left off: {{application_link}}`,
  },
};

const messageSchema = new Schema(
  {
    active: { type: Boolean, default: true },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    web: { type: String, default: "" },
    email: { type: String, default: "" },
    sms: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
  },
  { _id: false }
);

const careerResultMessagesSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    eligible: { type: messageSchema, default: () => DEFAULT_RESULT_MESSAGES.eligible },
    partial: { type: messageSchema, default: () => DEFAULT_RESULT_MESSAGES.partial },
    notEligible: { type: messageSchema, default: () => DEFAULT_RESULT_MESSAGES.notEligible },
    incomplete: { type: messageSchema, default: () => DEFAULT_RESULT_MESSAGES.incomplete },
    supportEmail: { type: String, default: "careers@bharatorganicexpo.com" },
    supportPhone: { type: String, default: "+91 96549 00525" },
  },
  { timestamps: true }
);

export default mongoose.models.CareerResultMessages ||
  mongoose.model("CareerResultMessages", careerResultMessagesSchema);
