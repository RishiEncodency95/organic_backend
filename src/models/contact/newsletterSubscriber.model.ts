import mongoose, { Schema } from "mongoose";

/*
 * Someone who subscribed to the newsletter from the website ("Stay Updated!" on the contact
 * page, "Stay Ahead." on the blog). Listed in Admin → Newsletter Subscribers.
 */
const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    /** Where they subscribed, e.g. "Contact Page", "Blog Sidebar" */
    source: { type: String, default: "Website", trim: true },
  },
  { timestamps: true }
);

const NewsletterSubscriber = mongoose.model("OrganicNewsletterSubscriber", newsletterSubscriberSchema);
export default NewsletterSubscriber;
