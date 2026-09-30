import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import ExpoEvent, { IPaymentPlan } from "../../models/expo/ExpoEvent.model";
import Stall, { STALL_STATUSES } from "../../models/expo/Stall.model";
import StallRate, { STALL_CURRENCIES } from "../../models/expo/StallRate.model";
import { resolveDropdownValue } from "../dropdowns/dropdownValue";

/* ------------------------------ helpers ------------------------------ */

const idParam = (value: unknown, what: string): string => {
  if (!isValidObjectId(value)) throw new ApiError(400, `Invalid ${what} id`);
  return String(value);
};

const text = (value: unknown, field: string, { required = true, max = 150 } = {}): string => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v && required) throw new ApiError(400, `${field} is required`);
  if (v.length > max) throw new ApiError(400, `${field} must be ${max} characters or fewer`);
  return v;
};

const number = (value: unknown, field: string, { min = 0, max = Infinity } = {}): number => {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n)) {
    throw new ApiError(400, `${field} must be a number`);
  }
  if (n < min || n > max) throw new ApiError(400, `${field} must be between ${min} and ${max === Infinity ? "∞" : max}`);
  return n;
};

const date = (value: unknown, field: string): Date => {
  const d = new Date(String(value));
  if (!value || Number.isNaN(d.getTime())) throw new ApiError(400, `${field} must be a valid date`);
  return d;
};

const existingEvent = async (id: unknown) => {
  const event = await ExpoEvent.findById(idParam(id, "event"));
  if (!event) throw new ApiError(404, "Event not found");
  return event;
};

const rethrowDuplicate = (message: string) => (error: any): never => {
  if (error?.code === 11000) throw new ApiError(409, message);
  throw error;
};

const paymentPlans = (value: unknown): IPaymentPlan[] => {
  if (!Array.isArray(value) || !value.length) throw new ApiError(400, "At least one payment plan is required");
  const plans = value.map((p: any, i) => ({
    id: text(p?.id, `Payment plan ${i + 1} id`, { max: 40 }),
    label: text(p?.label, `Payment plan ${i + 1} label`, { max: 60 }),
    percentage: number(p?.percentage, `Payment plan ${i + 1} percentage`, { min: 1, max: 100 }),
  }));
  if (new Set(plans.map((p) => p.id)).size !== plans.length) throw new ApiError(400, "Payment plan ids must be unique");
  return plans;
};

/** Validates the fields of an event body; `partial` allows leaving fields out (for PATCH). */
const eventFields = (body: any, partial: boolean) => {
  const out: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) out.name = text(body.name, "Event name");
  if (!partial || body.startDate !== undefined) out.startDate = date(body.startDate, "Start date");
  if (!partial || body.endDate !== undefined) out.endDate = date(body.endDate, "End date");
  if (body.venue !== undefined) out.venue = text(body.venue, "Venue", { required: false, max: 200 });
  if (body.city !== undefined) out.city = text(body.city, "City", { required: false, max: 80 });
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body.paymentPlans !== undefined) out.paymentPlans = paymentPlans(body.paymentPlans);
  return out;
};

const stallFields = async (body: any, partial: boolean) => {
  const out: Record<string, unknown> = {};
  if (!partial || body.stallNumber !== undefined) out.stallNumber = text(body.stallNumber, "Stall number", { max: 30 });
  if (body.hall !== undefined) out.hall = text(body.hall, "Hall", { required: false, max: 60 });
  if (!partial || body.stallType !== undefined) {
    out.stallType = await resolveDropdownValue("exhibitor-stall-type", body.stallType, { field: "Stall type", required: true });
  }
  if (!partial || body.length !== undefined) out.length = number(body.length, "Length (m)", { min: 0.5, max: 500 });
  if (!partial || body.width !== undefined) out.width = number(body.width, "Width (m)", { min: 0.5, max: 500 });
  if (body.plScheme !== undefined) {
    out.plScheme = await resolveDropdownValue("stall-pl-scheme", body.plScheme, { field: "Open sides", required: true });
  }
  if (body.incrementPercentage !== undefined) out.incrementPercentage = number(body.incrementPercentage, "Increment %", { max: 100 });
  if (body.discountPercentage !== undefined) out.discountPercentage = number(body.discountPercentage, "Discount %", { max: 100 });
  if (body.status !== undefined) {
    if (!STALL_STATUSES.includes(body.status)) throw new ApiError(400, `Status must be one of: ${STALL_STATUSES.join(", ")}`);
    out.status = body.status;
  }
  if (body.notes !== undefined) out.notes = text(body.notes, "Notes", { required: false, max: 500 });
  return out;
};

const area = (length: number, width: number) => Math.round(length * width * 100) / 100;

/* ------------------------------ public ------------------------------ */

/** GET /events/active → events open for stall booking, soonest first. */
export const getActiveEvents = asyncHandler(async (_req: Request, res: Response) => {
  const events = await ExpoEvent.find({ isActive: true }).sort({ startDate: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Active events fetched successfully", events));
});

/** GET /stalls/available?eventId= → stalls still free to book. */
export const getAvailableStalls = asyncHandler(async (req: Request, res: Response) => {
  const eventId = idParam(req.query.eventId, "event");
  const stalls = await Stall.find({ event: eventId, status: "available" })
    .sort({ hall: 1, stallNumber: 1 })
    .select("-notes")
    .lean();
  res.status(200).json(new ApiResponse(200, "Available stalls fetched successfully", stalls));
});

/** GET /stall-rates/event/:eventId → every stall type's rate, INR and USD. */
export const getEventRates = asyncHandler(async (req: Request, res: Response) => {
  const eventId = idParam(req.params.eventId, "event");
  const rates = await StallRate.find({ event: eventId }).sort({ stallType: 1, currency: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Stall rates fetched successfully", rates));
});

/** GET /stall-rates/find?eventId=&currency=&stallType= → one rate, or data: null when none is set. */
export const findRate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = idParam(req.query.eventId, "event");
  const currency = String(req.query.currency || "").toUpperCase();
  if (!STALL_CURRENCIES.includes(currency as any)) throw new ApiError(400, "currency must be INR or USD");
  const stallType = text(req.query.stallType, "stallType");
  const rate = await StallRate.findOne({ event: eventId, currency, stallType: new RegExp(`^${stallType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
  res.status(200).json(new ApiResponse(200, rate ? "Stall rate found" : "No rate set for this stall type", rate));
});

/* ------------------------------ admin: events ------------------------------ */

export const listEvents = asyncHandler(async (_req: Request, res: Response) => {
  const [events, stallCounts] = await Promise.all([
    ExpoEvent.find().sort({ startDate: -1 }).lean(),
    Stall.aggregate([{ $group: { _id: { event: "$event", status: "$status" }, count: { $sum: 1 } } }]),
  ]);
  const counts: Record<string, Record<string, number>> = {};
  for (const c of stallCounts) {
    const key = String(c._id.event);
    counts[key] ??= {};
    counts[key][c._id.status] = c.count;
  }
  res.status(200).json(
    new ApiResponse(200, "Events fetched successfully", events.map((e: any) => ({ ...e, stallCounts: counts[String(e._id)] || {} })))
  );
});

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const fields = eventFields(req.body ?? {}, false);
  if ((fields.endDate as Date) < (fields.startDate as Date)) throw new ApiError(400, "End date cannot be before start date");
  const event = await ExpoEvent.create(fields);
  res.status(201).json(new ApiResponse(201, "Event created successfully", event));
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await existingEvent(req.params.id);
  event.set(eventFields(req.body ?? {}, true));
  if (event.endDate < event.startDate) throw new ApiError(400, "End date cannot be before start date");
  await event.save();
  res.status(200).json(new ApiResponse(200, "Event updated successfully", event));
});

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await existingEvent(req.params.id);
  const stalls = await Stall.countDocuments({ event: event._id });
  if (stalls) throw new ApiError(409, `This event has ${stalls} stall(s). Delete them first, or mark the event inactive.`);
  await StallRate.deleteMany({ event: event._id });
  await event.deleteOne();
  res.status(200).json(new ApiResponse(200, "Event deleted successfully", null));
});

/* ------------------------------ admin: stalls ------------------------------ */

export const listStalls = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { event: idParam(req.query.eventId, "event") };
  if (req.query.status !== undefined) {
    if (!STALL_STATUSES.includes(req.query.status as any)) throw new ApiError(400, "Invalid status filter");
    filter.status = req.query.status;
  }
  const stalls = await Stall.find(filter).sort({ hall: 1, stallNumber: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Stalls fetched successfully", stalls));
});

export const createStall = asyncHandler(async (req: Request, res: Response) => {
  const event = await existingEvent(req.body?.eventId);
  const fields = await stallFields(req.body ?? {}, false);
  const stall = await Stall.create({
    ...fields,
    event: event._id,
    area: area(fields.length as number, fields.width as number),
  }).catch(rethrowDuplicate("A stall with this number already exists for this event"));
  res.status(201).json(new ApiResponse(201, "Stall created successfully", stall));
});

/** POST /stalls/admin/bulk { eventId, stalls: [...] } — all-or-nothing; reports every bad row. */
export const createStallsBulk = asyncHandler(async (req: Request, res: Response) => {
  const event = await existingEvent(req.body?.eventId);
  const rows = req.body?.stalls;
  if (!Array.isArray(rows) || !rows.length) throw new ApiError(400, "stalls must be a non-empty array");
  if (rows.length > 500) throw new ApiError(400, "At most 500 stalls per request");

  const docs: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (const [i, row] of rows.entries()) {
    try {
      const fields = await stallFields(row ?? {}, false);
      docs.push({ ...fields, event: event._id, area: area(fields.length as number, fields.width as number) });
    } catch (error) {
      if (error instanceof ApiError) errors.push(`Row ${i + 1}: ${error.message}`);
      else throw error;
    }
  }
  const numbers = docs.map((d) => String(d.stallNumber).toLowerCase());
  const repeated = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  if (repeated.length) errors.push(`Stall numbers repeated in the upload: ${[...new Set(repeated)].join(", ")}`);
  const clashes = await Stall.find({ event: event._id, stallNumber: { $in: docs.map((d) => d.stallNumber) } }).select("stallNumber").lean();
  if (clashes.length) errors.push(`Already exist for this event: ${clashes.map((c: any) => c.stallNumber).join(", ")}`);
  if (errors.length) throw new ApiError(400, errors[0], errors);

  const created = await Stall.insertMany(docs);
  res.status(201).json(new ApiResponse(201, `${created.length} stalls created`, created));
});

export const updateStall = asyncHandler(async (req: Request, res: Response) => {
  const stall = await Stall.findById(idParam(req.params.id, "stall"));
  if (!stall) throw new ApiError(404, "Stall not found");
  if (req.body?.eventId !== undefined && String(req.body.eventId) !== String(stall.event)) {
    throw new ApiError(400, "A stall cannot be moved to another event");
  }
  stall.set(await stallFields(req.body ?? {}, true));
  stall.area = area(stall.length, stall.width);
  await stall.save().catch(rethrowDuplicate("A stall with this number already exists for this event"));
  res.status(200).json(new ApiResponse(200, "Stall updated successfully", stall));
});

export const deleteStall = asyncHandler(async (req: Request, res: Response) => {
  const stall = await Stall.findById(idParam(req.params.id, "stall"));
  if (!stall) throw new ApiError(404, "Stall not found");
  if (stall.status === "booked") throw new ApiError(409, "A booked stall cannot be deleted. Change its status first.");
  await stall.deleteOne();
  res.status(200).json(new ApiResponse(200, "Stall deleted successfully", null));
});

/* ------------------------------ admin: rates ------------------------------ */

export const listRates = asyncHandler(async (req: Request, res: Response) => {
  const rates = await StallRate.find({ event: idParam(req.query.eventId, "event") }).sort({ stallType: 1, currency: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Stall rates fetched successfully", rates));
});

/** PUT /stall-rates/admin { eventId, stallType, currency, ratePerSqm } — creates or updates that rate. */
export const upsertRate = asyncHandler(async (req: Request, res: Response) => {
  const event = await existingEvent(req.body?.eventId);
  const stallType = await resolveDropdownValue("exhibitor-stall-type", req.body?.stallType, { field: "Stall type", required: true });
  const currency = String(req.body?.currency || "").toUpperCase();
  if (!STALL_CURRENCIES.includes(currency as any)) throw new ApiError(400, "Currency must be INR or USD");
  const ratePerSqm = number(req.body?.ratePerSqm, "Rate per sq m", { min: 0 });

  const rate = await StallRate.findOneAndUpdate(
    { event: event._id, stallType, currency },
    { $set: { ratePerSqm } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(200).json(new ApiResponse(200, "Stall rate saved successfully", rate));
});

export const deleteRate = asyncHandler(async (req: Request, res: Response) => {
  const rate = await StallRate.findByIdAndDelete(idParam(req.params.id, "rate"));
  if (!rate) throw new ApiError(404, "Stall rate not found");
  res.status(200).json(new ApiResponse(200, "Stall rate deleted successfully", null));
});
