import { isValidObjectId } from "mongoose";
import Feedback from "../../models/contact/feedback.model";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary";
import { ApiError } from "../../utils/ApiError";
import { emailProblem } from "../../utils/emailCheck";

export const FEEDBACK_ROLES = ["Exhibitor", "Buyer", "Visitor", "Speaker", "Partner / Association", "Media"];
export const FEEDBACK_STATUSES = ["new", "reviewed", "contacted"] as const;

const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const stars = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
};
// The form is sent as multipart (it can carry two images), so booleans arrive as text
const flag = (v: unknown) => v === true || v === "true" || v === "yes" || v === "1";

type UploadedImage = { buffer: Buffer; originalname: string };

/** Optional photo / logo. A failed upload never blocks the feedback itself: "" is stored instead. */
const uploadFeedbackImage = (file: UploadedImage | undefined, kind: "photo" | "logo"): Promise<string> =>
  new Promise((resolve) => {
    if (!file || !isCloudinaryConfigured()) return resolve("");
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `bharat-organic-expo/feedback/${kind}s`,
        resource_type: "image",
        transformation: [{ width: 800, height: 800, crop: "limit" }],
      },
      (error, result) => {
        if (error || !result) {
          console.warn(`Feedback ${kind} upload failed:`, error?.message || error);
          return resolve("");
        }
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });

export const createFeedbackService = async (payload: any, files: { photo?: UploadedImage; logo?: UploadedImage } = {}) => {
  const role = text(payload?.role, 60).replace(/\s+/g, " ");
  const name = text(payload?.name, 120);
  const company = text(payload?.company, 200);
  const phone = text(payload?.phone).replace(/\D/g, "").slice(-10);
  const email = text(payload?.email, 255).toLowerCase();
  const edition = text(payload?.edition, 80);
  const overall = stars(payload?.overallRating);
  const valuable = text(payload?.valuable, 2000);

  if (!FEEDBACK_ROLES.includes(role)) throw ApiError.badRequest("Please choose how you participated.");
  if (name.length < 2) throw ApiError.badRequest("Please enter your name.");
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) throw ApiError.badRequest("Name can have letters only.");
  if (company.length < 2) throw ApiError.badRequest("Please enter your company / organisation.");
  if (!/^[6-9]\d{9}$/.test(phone)) throw ApiError.badRequest("Enter a valid 10-digit mobile number.");
  if (email) {
    const problem = emailProblem(email, "Email");
    if (problem) throw ApiError.badRequest(problem);
  }
  if (!edition) throw ApiError.badRequest("Please choose the edition you attended.");
  if (!overall) throw ApiError.badRequest("Please rate your overall experience.");
  if (valuable.length < 10) throw ApiError.badRequest("Please tell us what was most valuable (at least 10 characters).");

  // One feedback per number and edition a day: a double click or a repeat visit does not save twice
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await Feedback.findOne({ phone, edition, createdAt: { $gte: since } }).select("_id").lean();
  if (duplicate) throw new ApiError(409, "We have already received your feedback. Thank you!");

  const [photo, logo] = await Promise.all([
    uploadFeedbackImage(files.photo, "photo"),
    uploadFeedbackImage(files.logo, "logo"),
  ]);

  const doc = await Feedback.create({
    role,
    name,
    company,
    designation: text(payload?.designation, 120),
    phone,
    email,
    edition,
    ratings: {
      overall,
      networking: stars(payload?.networkingRating),
      quality: stars(payload?.qualityRating),
      management: stars(payload?.managementRating),
    },
    valuable,
    improve: text(payload?.improve, 2000),
    consentToFeature: flag(payload?.consentToFeature),
    wantsContact: flag(payload?.wantsContact),
    photo,
    logo,
  });

  return {
    id: doc._id,
    // true when an image was sent but could not be stored
    imagesSkipped: Boolean((files.photo && !photo) || (files.logo && !logo)),
  };
};

export const listFeedbackService = async () => {
  const items = await Feedback.find().sort({ createdAt: -1 }).limit(2000).lean();
  return { items, total: items.length };
};

export const updateFeedbackStatusService = async (id: string, status: unknown) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid feedback id.");
  if (!FEEDBACK_STATUSES.includes(status as any)) {
    throw ApiError.badRequest(`Status must be one of: ${FEEDBACK_STATUSES.join(", ")}`);
  }
  const doc = await Feedback.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!doc) throw ApiError.notFound("Feedback not found.");
  return doc;
};

export const deleteFeedbackService = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid feedback id.");
  const doc = await Feedback.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound("Feedback not found.");
  return doc;
};
