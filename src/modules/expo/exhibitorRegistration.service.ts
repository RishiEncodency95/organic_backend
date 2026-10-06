import crypto from "crypto";
import mongoose from "mongoose";
import ExhibitorRegistration, {
  EXHIBITOR_CATEGORIES,
  EXHIBITOR_PAYMENT_STATUSES,
  EXHIBITOR_STATUSES,
} from "../../models/expo/ExhibitorRegistration.model";
import ExpoEvent from "../../models/expo/ExpoEvent.model";
import Stall from "../../models/expo/Stall.model";
import StallRate from "../../models/expo/StallRate.model";
import Settings from "../../models/settings.model";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

type Category = (typeof EXHIBITOR_CATEGORIES)[number];

const text = (v: unknown, max = 300) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
const isId = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);

/** Plain-JSON copy of the rest of the form (strings, numbers, booleans, small arrays/objects). */
const clean = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim().slice(0, 2000) || undefined;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 3) return undefined;
  if (Array.isArray(value)) {
    const out = value.slice(0, 50).map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      if (k.startsWith("_")) continue;
      const c = clean(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
};

// Fields copied to their own columns, or amounts the server recalculates — not kept in `details`
const DETAIL_SKIP = new Set([
  "eventId", "exhibitorName", "fasciaName", "typeOfBusiness", "natureOfBusiness", "industrySector", "website", "address",
  "country", "state", "city", "pincode", "gstNo", "panNo", "contact1", "contact2", "participation", "financeBreakdown",
  "paymentMode", "paymentPlanType", "paymentPlanLabel", "amountPaid", "balanceAmount", "status", "paymentId",
  "razorpayOrderId", "razorpaySignature", "registrationSource",
]);

const contact = (c: any) => ({
  title: text(c?.title, 10),
  firstName: text(c?.firstName, 80),
  lastName: text(c?.lastName, 80),
  email: text(c?.email, 200).toLowerCase(),
  designation: text(c?.designation, 120),
  mobile: text(c?.mobile, 25),
  alternateNo: text(c?.alternateNo, 25),
});

/**
 * Same steps as the book-a-stand page shows the customer, worked out on the server so the
 * amount charged can't be changed in the browser.
 */
const priceFor = (opts: {
  area: number;
  ratePerSqm: number;
  incrementPct: number;
  stallDiscountPct: number;
  planPercent: number;
  isFullPayment: boolean;
  fullPaymentDiscountPct: number;
  tdsPct: number;
}) => {
  const base = opts.area * opts.ratePerSqm;
  const gross = base + (base * opts.incrementPct) / 100;
  const stallDiscount = Math.round((gross * opts.stallDiscountPct) / 100);
  const subtotal1 = gross - stallDiscount;
  const fpPct = opts.isFullPayment ? opts.fullPaymentDiscountPct : 0;
  const fpDiscount = Math.round((subtotal1 * fpPct) / 100);
  const subtotal = subtotal1 - fpDiscount;
  const gst = Math.round(subtotal * 0.18);
  const invoiceTotal = subtotal + gst;
  const tds = Math.round((subtotal * opts.tdsPct) / 100);
  const netPayable = invoiceTotal - tds;
  const dueNow = Math.round(netPayable * (opts.planPercent / 100));
  return {
    finance: {
      area: opts.area,
      ratePerSqm: opts.ratePerSqm,
      grossAmount: Math.round(gross),
      plIncrementPercent: opts.incrementPct,
      stallDiscountPercent: opts.stallDiscountPct,
      stallDiscountAmount: stallDiscount,
      subtotal1: Math.round(subtotal1),
      fullPaymentDiscountPercent: fpPct,
      fullPaymentDiscountAmount: fpDiscount,
      subtotal: Math.round(subtotal),
      gstPercent: 18,
      gstAmount: gst,
      invoiceTotal: Math.round(invoiceTotal),
      tdsPercent: opts.tdsPct,
      tdsAmount: tds,
      netPayable: Math.round(netPayable),
    },
    netPayable: Math.round(netPayable),
    dueNow,
    balance: Math.round(netPayable - dueNow),
  };
};

const PREFIX: Record<Category, string> = { domestic: "BOE27-DE", international: "BOE27-IE" };

const nextRegistrationNo = async (category: Category) => {
  const prefix = PREFIX[category];
  const last: any = await ExhibitorRegistration.findOne({ registrationNo: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ createdAt: -1 })
    .select("registrationNo")
    .lean();
  const n = last ? parseInt(String(last.registrationNo).split("-").pop() || "0", 10) : 0;
  return `${prefix}-${String(n + 1).padStart(5, "0")}`;
};

/** POST /exhibitor-registration — saves the booking before payment. */
export const createExhibitorRegistrationService = async (body: any) => {
  const exhibitorName = text(body?.exhibitorName, 200);
  const c1 = contact(body?.contact1);
  if (!exhibitorName) throw ApiError.badRequest("Please enter the exhibitor / company name.");
  if (!c1.firstName) throw ApiError.badRequest("Please enter the contact person's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c1.email)) throw ApiError.badRequest("Please enter a valid email address.");
  if (!/^\+?\d[\d\s-]{6,18}$/.test(c1.mobile)) throw ApiError.badRequest("Please enter a valid mobile number.");

  const eventId = body?.eventId;
  const stallId = body?.participation?.stallNo;
  if (!isId(eventId)) throw ApiError.badRequest("Please choose the expo event.");
  if (!isId(stallId)) throw ApiError.badRequest("Please select a stall first.");

  const currency = text(body?.participation?.currency, 3).toUpperCase() === "USD" ? "USD" : "INR";
  const category: Category = currency === "USD" ? "international" : "domestic";

  const [event, stall]: any[] = await Promise.all([ExpoEvent.findById(eventId).lean(), Stall.findById(stallId).lean()]);
  if (!event) throw ApiError.badRequest("This expo event was not found.");
  if (!stall || String(stall.event) !== String(eventId)) throw ApiError.badRequest("This stall was not found for the selected event.");
  if (stall.status !== "available") throw ApiError.badRequest("This stall was just booked by someone else. Please select a different stall.");

  const rate: any = await StallRate.findOne({ event: eventId, currency, stallType: stall.stallType }).lean();
  if (!rate) throw ApiError.badRequest(`No ${currency} rate is set for ${stall.stallType}. Please contact us.`);

  const plans: any[] = Array.isArray(event.paymentPlans) && event.paymentPlans.length ? event.paymentPlans : [{ id: "full", label: "Full Payment", percentage: 100 }];
  const plan = plans.find((p) => p.id === text(body?.paymentPlanType, 40)) || plans.find((p) => p.id === "full") || plans[0];
  const planPercent = Math.min(100, Math.max(1, Number(plan.percentage) || 100));
  const settings: any = await Settings.findOne({ website: "Organicexpo" }).lean();
  const tdsPct = category === "domestic" && [0, 1, 2].includes(Number(body?.chosenTdsPercent)) ? Number(body.chosenTdsPercent) : 0;

  const price = priceFor({
    area: Number(stall.area) || 0,
    ratePerSqm: Number(rate.ratePerSqm) || 0,
    incrementPct: Number(stall.incrementPercentage) || 0,
    stallDiscountPct: Number(stall.discountPercentage) || 0,
    planPercent,
    isFullPayment: plan.id === "full" || planPercent === 100,
    fullPaymentDiscountPct: Number(settings?.fullPaymentDiscount) || 0,
    tdsPct,
  });
  if (price.dueNow <= 0) throw ApiError.badRequest("The stall amount could not be worked out. Please contact us.");

  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (DETAIL_SKIP.has(k)) continue;
    const c = clean(v);
    if (c !== undefined) details[k] = c;
  }

  const doc = {
    category,
    event: event._id,
    eventName: text(event.name, 120),
    exhibitorName,
    fasciaName: text(body?.fasciaName, 120),
    typeOfBusiness: text(body?.typeOfBusiness, 120),
    natureOfBusiness: text(body?.natureOfBusiness, 120),
    industrySector: text(body?.industrySector, 200),
    website: text(body?.website, 200),
    address: text(body?.address, 500),
    country: text(body?.country, 80),
    state: text(body?.state, 80),
    city: text(body?.city, 80),
    pincode: text(body?.pincode, 15),
    gstNo: text(body?.gstNo, 20),
    panNo: text(body?.panNo, 15),
    contact1: c1,
    contact2: contact(body?.contact2),
    stall: stall._id,
    stallNumber: text(stall.stallNumber, 30),
    hall: text(stall.hall, 60),
    stallType: text(stall.stallType, 60),
    stallArea: Number(stall.area) || 0,
    plScheme: text(stall.plScheme, 60),
    currency,
    ratePerSqm: Number(rate.ratePerSqm) || 0,
    finance: price.finance,
    paymentPlanId: String(plan.id),
    paymentPlanLabel: text(plan.label, 60) || "Full Payment",
    netPayable: price.netPayable,
    amountDueNow: price.dueNow,
    amountPaid: 0,
    balanceAmount: price.netPayable,
    details,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await ExhibitorRegistration.create({ ...doc, registrationNo: await nextRegistrationNo(category) });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw ApiError.internal("Could not save the registration. Please try again.");
};

/* ───────── Razorpay ───────── */

const razorpayAuth = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw ApiError.internal("Online payment is not configured.");
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
};

// The website adds a 2.5% gateway fee on top of the amount due now.
const gatewayAmount = (dueNow: number) => Math.round(dueNow * 1.025 * 100) / 100;

/** POST /payment/create-order/:id — order for the amount the server worked out. */
export const createExhibitorOrderService = async (id: string) => {
  if (!isId(id)) throw ApiError.badRequest("Invalid registration.");
  const reg: any = await ExhibitorRegistration.findById(id);
  if (!reg) throw ApiError.notFound("Registration not found.");
  if (reg.paymentStatus === "paid") throw ApiError.badRequest("This registration is already paid.");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(gatewayAmount(reg.amountDueNow) * 100), // paise / cents
      currency: reg.currency,
      receipt: reg.registrationNo,
      notes: { registrationNo: reg.registrationNo, stall: reg.stallNumber, exhibitor: reg.exhibitorName },
    }),
  });
  const order: any = await res.json().catch(() => null);
  if (!res.ok || !order?.id) {
    throw ApiError.internal(order?.error?.description || "Could not start the payment. Please try again.");
  }
  reg.razorpayOrderId = order.id;
  await reg.save();
  return { key: env.RAZORPAY_KEY_ID, order };
};

/** POST /payment/verify-payment — checks Razorpay's signature, marks paid and books the stall. */
export const verifyExhibitorPaymentService = async (body: any) => {
  const orderId = text(body?.razorpay_order_id, 60);
  const paymentId = text(body?.razorpay_payment_id, 60);
  const signature = text(body?.razorpay_signature, 200);
  const regId = body?.registrationId;
  if (!orderId || !paymentId || !signature || !isId(regId)) throw ApiError.badRequest("Payment details are missing.");

  const reg: any = await ExhibitorRegistration.findById(regId);
  if (!reg) throw ApiError.notFound("Registration not found.");
  if (reg.paymentStatus === "paid") return reg;
  if (reg.razorpayOrderId !== orderId) throw ApiError.badRequest("This payment does not belong to this registration.");

  const expected = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET || "").update(`${orderId}|${paymentId}`).digest("hex");
  const valid =
    expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    reg.paymentStatus = "failed";
    await reg.save();
    throw ApiError.badRequest("Payment verification failed.");
  }

  // Book the stall only if it is still free; otherwise keep the payment and flag it for the team.
  const booked = await Stall.findOneAndUpdate({ _id: reg.stall, status: "available" }, { status: "booked" }, { new: true });
  reg.paymentStatus = "paid";
  reg.razorpayPaymentId = paymentId;
  reg.paidAt = new Date();
  reg.amountPaid = reg.amountDueNow;
  reg.balanceAmount = Math.max(0, reg.netPayable - reg.amountDueNow);
  reg.stallConflict = !booked;
  await reg.save();
  return reg;
};

/* ───────── Admin ───────── */

export const listExhibitorRegistrationsService = async (query: any = {}) => {
  const filter: Record<string, unknown> = {};
  if (EXHIBITOR_CATEGORIES.includes(query?.category)) filter.category = query.category;
  if (EXHIBITOR_STATUSES.includes(query?.status)) filter.status = query.status;
  if (EXHIBITOR_PAYMENT_STATUSES.includes(query?.paymentStatus)) filter.paymentStatus = query.paymentStatus;
  const limit = Math.min(parseInt(query?.limit, 10) || 1000, 2000);
  const [registrations, total] = await Promise.all([
    ExhibitorRegistration.find(filter).sort({ createdAt: -1 }).limit(limit).select("-details -finance").lean(),
    ExhibitorRegistration.countDocuments(filter),
  ]);
  return { registrations, total };
};

export const getExhibitorRegistrationService = async (id: string) => {
  if (!isId(id)) throw ApiError.badRequest("Invalid registration.");
  const doc = await ExhibitorRegistration.findById(id).lean();
  if (!doc) throw ApiError.notFound("Exhibitor registration not found.");
  return doc;
};

export const updateExhibitorStatusService = async (id: string, status: unknown, by: string) => {
  if (!EXHIBITOR_STATUSES.includes(status as any)) {
    throw ApiError.badRequest(`Status must be one of: ${EXHIBITOR_STATUSES.join(", ")}`);
  }
  const doc = await ExhibitorRegistration.findByIdAndUpdate(
    id,
    { status, statusUpdatedBy: by, statusUpdatedAt: new Date() },
    { new: true, runValidators: true }
  ).select("-details -finance");
  if (!doc) throw ApiError.notFound("Exhibitor registration not found.");
  return doc;
};

export const deleteExhibitorRegistrationService = async (id: string) => {
  const doc = await ExhibitorRegistration.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound("Exhibitor registration not found.");
  return doc;
};
