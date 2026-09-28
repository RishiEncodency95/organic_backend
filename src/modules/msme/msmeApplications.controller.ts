import { Request, Response } from "express";
import crypto from "crypto";
import MsmeApplication from "../../models/msme/MsmeApplication.model";
import Counter from "../../models/careers/Counter.model";
import { env } from "../../config/env";
import { sendMsmeCandidateConfirmationEmail, sendMsmeAdminNotificationEmail } from "../../services/msmeEmail.service";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Pricing lives on the server so the amount charged can never be chosen by the browser.
const STALL_RATE = 11000;
const GST_RATE = 0.18;
const STALL_SIZES = [9, 12, 15, 18];

/** Total payable (₹, inclusive of GST) for a stall size, or null if the size isn't one we offer. */
const stallAmount = (stallSize: unknown): number | null => {
  const size = Number(stallSize);
  if (!STALL_SIZES.includes(size)) return null;
  return Math.round(size * STALL_RATE * (1 + GST_RATE));
};

const razorpayAuthHeader = () =>
  `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

/**
 * Generate unique, server-side sequential Application ID: MSME<current year>-000001
 */
export const generateNextMsmeApplicationId = async (): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "msmeApplicationId_seq" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(6, "0");
  const year = new Date().getFullYear();
  return `MSME${year}-${seqStr}`;
};

/** Looks an application up by its applicationId first, falling back to Mongo _id. */
const findApplication = async (idParam: string) => {
  let application = await MsmeApplication.findOne({ applicationId: idParam });
  if (!application && OBJECT_ID_RE.test(idParam)) {
    application = await MsmeApplication.findById(idParam);
  }
  return application;
};

/**
 * Create a new draft, or update an existing one's enterprise details when an
 * applicationId is supplied — mirrors the careers "find or create" draft pattern.
 */
export const saveEnterpriseDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { applicationId, enterprise } = req.body;

    if (!enterprise || typeof enterprise !== "object") {
      res.status(400).json({ success: false, message: "enterprise details are required." });
      return;
    }

    let application = applicationId ? await findApplication(applicationId) : null;

    if (!application) {
      const newId = await generateNextMsmeApplicationId();
      application = await MsmeApplication.create({
        applicationId: newId,
        status: "ENTERPRISE_SAVED",
        enterprise,
      });
    } else {
      application.enterprise = { ...application.enterprise, ...enterprise };
      if (application.status === "DRAFT") application.status = "ENTERPRISE_SAVED";
      await application.save();
    }

    res.status(200).json({
      success: true,
      message: "Enterprise details saved.",
      data: application,
    });
  } catch (error) {
    console.error("Save enterprise details error:", error);
    res.status(500).json({
      success: false,
      message: "Could not save enterprise details. Please try again.",
      error: (error as Error).message,
    });
  }
};

/** Saves the stall/contact-person participation details onto an existing draft. */
export const saveParticipationDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { participation } = req.body;

    if (!participation || typeof participation !== "object") {
      res.status(400).json({ success: false, message: "participation details are required." });
      return;
    }

    const application = await findApplication(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    if (application.payment?.status === "PAID") {
      res.status(409).json({ success: false, message: "This application has already been paid for and submitted." });
      return;
    }

    if (participation.stallSize !== undefined && stallAmount(participation.stallSize) === null) {
      res.status(400).json({ success: false, message: `Stall size must be one of ${STALL_SIZES.join(", ")} sqm.` });
      return;
    }

    application.participation = { ...application.participation, ...participation };
    application.status = "PARTICIPATION_SAVED";
    await application.save();

    res.status(200).json({
      success: true,
      message: "Participation details saved.",
      data: application,
    });
  } catch (error) {
    console.error("Save participation details error:", error);
    res.status(500).json({
      success: false,
      message: "Could not save participation details. Please try again.",
      error: (error as Error).message,
    });
  }
};

/**
 * Creates the Razorpay order server-side (never trusting a client-supplied order id)
 * and records it on the application. Called right before the checkout modal opens, so
 * a payment can be traced even if it's abandoned.
 */
export const recordPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const currency = "INR";

    const application = await findApplication(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    if (application.payment?.status === "PAID") {
      res.status(409).json({ success: false, message: "This application has already been paid for and submitted." });
      return;
    }

    // Any amount the client sends is ignored — it is derived from the saved stall size.
    const amount = stallAmount(application.participation?.stallSize);
    if (amount === null) {
      res.status(400).json({ success: false, message: "Please complete Step 2 (Participation Details) before paying." });
      return;
    }

    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      res.status(500).json({ success: false, message: "Payments are not configured on the server." });
      return;
    }

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay expects paise
        currency,
        receipt: `msme_${application.applicationId}`,
      }),
    });
    const order = (await orderRes.json()) as { id: string; amount: number; currency: string; error?: { description?: string } };

    if (!orderRes.ok) {
      res.status(502).json({
        success: false,
        message: order?.error?.description || "Could not create the payment order.",
      });
      return;
    }

    application.payment = {
      ...application.payment,
      amount,
      currency,
      razorpayOrderId: order.id,
      razorpayPaymentId: undefined,
      razorpaySignature: undefined,
      status: "PENDING",
      failureReason: undefined,
      failedAt: undefined,
    };
    application.status = "PAYMENT_PENDING";
    await application.save();

    res.status(200).json({
      success: true,
      message: "Payment order created.",
      data: {
        applicationId: application.applicationId,
        razorpayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Record payment order error:", error);
    res.status(500).json({
      success: false,
      message: "Could not create the payment order. Please try again.",
      error: (error as Error).message,
    });
  }
};

/**
 * Confirms a completed Razorpay payment and marks the application SUBMITTED.
 * Verifies the HMAC-SHA256 signature server-side against the order id we created and
 * stored ourselves — a client can never fabricate a valid signature without the
 * account's key secret, so this is the actual proof the payment happened.
 */
export const confirmPaymentAndSubmit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ success: false, message: "Payment confirmation is incomplete." });
      return;
    }

    const application = await findApplication(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const razorpayOrderId = application.payment?.razorpayOrderId;
    if (!razorpayOrderId) {
      res.status(400).json({ success: false, message: "No payment order was raised for this application." });
      return;
    }

    if (!env.RAZORPAY_KEY_SECRET) {
      res.status(500).json({ success: false, message: "Payments are not configured on the server." });
      return;
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      application.payment = { ...application.payment, status: "FAILED" };
      application.status = "PAYMENT_FAILED";
      await application.save();

      res.status(400).json({
        success: false,
        message: "Payment could not be verified. If money was deducted, please contact support with your Application ID.",
      });
      return;
    }

    if (!application.enterprise?.mobile && !application.enterprise?.email) {
      res.status(400).json({
        success: false,
        message: "Enterprise contact details are incomplete. Please complete Step 1 before paying.",
      });
      return;
    }

    application.payment = {
      ...application.payment,
      razorpayPaymentId,
      razorpaySignature,
      status: "PAID",
      paidAt: new Date(),
      failureReason: undefined,
      failedAt: undefined,
    };
    application.status = "SUBMITTED";
    application.submittedAt = new Date();
    application.reviewStatus = "PENDING_REVIEW";
    await application.save();

    if (application.enterprise?.email) {
      const emailOpts = {
        recipientEmail: application.enterprise.email,
        enterpriseName: application.enterprise.enterpriseName || "Applicant",
        applicationId: application.applicationId,
        stallType: application.participation?.stallType,
        stallSize: application.participation?.stallSize,
        amount: application.payment?.amount,
        submittedAt: application.submittedAt,
      };

      sendMsmeCandidateConfirmationEmail(emailOpts).catch((err) =>
        console.error("MSME candidate email background send error:", err)
      );
      sendMsmeAdminNotificationEmail(emailOpts).catch((err) =>
        console.error("MSME admin email background send error:", err)
      );
    }

    res.status(200).json({
      success: true,
      message: "Payment confirmed and application submitted.",
      data: {
        applicationId: application.applicationId,
        status: application.status,
        submittedAt: application.submittedAt,
      },
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({
      success: false,
      message: "Could not confirm payment. Please contact support with your Application ID.",
      error: (error as Error).message,
    });
  }
};

/**
 * Records a failed checkout attempt. The browser only tells us which payment failed —
 * the failure itself is read back from Razorpay, so nobody can mark an application
 * failed by calling this with made-up data, and a paid application is never touched.
 */
export const recordPaymentFailure = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { razorpayPaymentId } = req.body;

    if (!razorpayPaymentId || typeof razorpayPaymentId !== "string") {
      res.status(400).json({ success: false, message: "razorpayPaymentId is required." });
      return;
    }

    const application = await findApplication(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    if (application.payment?.status === "PAID") {
      res.status(200).json({ success: true, message: "Application is already paid.", data: { status: application.status } });
      return;
    }

    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      res.status(500).json({ success: false, message: "Payments are not configured on the server." });
      return;
    }

    const paymentRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
      { headers: { Authorization: razorpayAuthHeader() } }
    );
    const payment = (await paymentRes.json()) as { order_id?: string; status?: string; error_description?: string };

    if (!paymentRes.ok || payment.order_id !== application.payment?.razorpayOrderId || payment.status !== "failed") {
      res.status(400).json({ success: false, message: "This payment is not a failed payment for this application." });
      return;
    }

    application.payment = {
      ...application.payment,
      razorpayPaymentId,
      status: "FAILED",
      failureReason: payment.error_description || "Payment failed.",
      failedAt: new Date(),
    };
    application.status = "PAYMENT_FAILED";
    await application.save();

    res.status(200).json({ success: true, message: "Payment failure recorded.", data: { status: application.status } });
  } catch (error) {
    console.error("Record payment failure error:", error);
    res.status(500).json({
      success: false,
      message: "Could not record the payment failure.",
      error: (error as Error).message,
    });
  }
};

export const getMsmeApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const application = await findApplication(id);

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    res.status(200).json({ success: true, data: application });
  } catch (error) {
    console.error("Get MSME application error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch the application.",
      error: (error as Error).message,
    });
  }
};

/* =========================================================
   ADMIN
   ========================================================= */

export const getAdminMsmeApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    let applications = await MsmeApplication.find(filter).sort({ createdAt: -1 });

    if (search) {
      const term = search.toLowerCase();
      applications = applications.filter((app) => {
        return (
          app.applicationId.toLowerCase().includes(term) ||
          app.enterprise?.enterpriseName?.toLowerCase().includes(term) ||
          app.enterprise?.udyamNumber?.toLowerCase().includes(term) ||
          app.enterprise?.email?.toLowerCase().includes(term) ||
          app.enterprise?.mobile?.includes(term)
        );
      });
    }

    res.status(200).json({ success: true, count: applications.length, data: applications });
  } catch (error) {
    console.error("Get admin MSME applications error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch applications.",
      error: (error as Error).message,
    });
  }
};

export const getAdminMsmeApplicationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const application = await findApplication(id);

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    res.status(200).json({ success: true, data: application });
  } catch (error) {
    console.error("Get admin MSME application error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch the application.",
      error: (error as Error).message,
    });
  }
};

/** Records staff review of a submitted application (approve/reject/needs info + note). */
export const updateMsmeReviewStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reviewStatus, note, reviewedBy } = req.body;

    const validStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_INFO"];
    if (!validStatuses.includes(reviewStatus)) {
      res.status(400).json({ success: false, message: `reviewStatus must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const application = await findApplication(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    application.reviewStatus = reviewStatus;
    application.reviewNote = note || undefined;
    application.reviewedBy = reviewedBy || req.user?.id || "Admin";
    application.reviewedAt = new Date();
    await application.save();

    res.status(200).json({
      success: true,
      message: `Application marked as ${reviewStatus}.`,
      data: application,
    });
  } catch (error) {
    console.error("Update MSME review status error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update the review status.",
      error: (error as Error).message,
    });
  }
};
