import { isValidObjectId } from "mongoose";
import NewsletterSubscriber from "../../models/contact/newsletterSubscriber.model";
import { ApiError } from "../../utils/ApiError";
import { emailProblem } from "../../utils/emailCheck";

const SOURCES = ["Contact Page", "Blog Sidebar", "Blog Article", "Website"];

/** Subscribes an email; subscribing twice is not an error (the address is simply kept) */
export const subscribeNewsletterService = async (payload: { email?: unknown; source?: unknown }) => {
  const email = String(payload?.email ?? "").trim().toLowerCase().slice(0, 255);
  const problem = emailProblem(email, "Email");
  if (problem) throw ApiError.badRequest(problem);
  const source = SOURCES.includes(String(payload?.source)) ? String(payload?.source) : "Website";

  const existing = await NewsletterSubscriber.findOne({ email }).select("_id").lean();
  if (existing) return { alreadySubscribed: true };
  try {
    await NewsletterSubscriber.create({ email, source });
  } catch (err: any) {
    // Two requests at once for the same address: the unique index keeps one
    if (err?.code !== 11000) throw err;
    return { alreadySubscribed: true };
  }
  return { alreadySubscribed: false };
};

export const listNewsletterSubscribersService = async () => NewsletterSubscriber.find().sort({ createdAt: -1 }).limit(5000).lean();

export const deleteNewsletterSubscriberService = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid subscriber id.");
  const doc = await NewsletterSubscriber.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound("Subscriber not found.");
  return doc;
};
