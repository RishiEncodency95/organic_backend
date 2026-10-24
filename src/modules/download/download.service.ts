import { isValidObjectId } from "mongoose";
import Download, { DOWNLOAD_STATUSES, type DownloadStatus } from "../../models/download.model";
import { ApiError } from "../../utils/ApiError";
import { isPdfBuffer, removeStoredPdf, storePdf } from "./download.storage";

export const DOWNLOAD_LIMITS = { name: 120, orderBy: 9999 } as const;

/** A PDF received by multer (kept in memory until it is stored) */
export type UploadedPdf = { buffer: Buffer; originalName: string; size: number };

const AUDIT_FIELDS = "name email";
const sorted = { orderBy: 1 as const, createdAt: 1 as const };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Website: active items in order, only what the menu needs */
export const listPublicDownloadsService = () =>
  Download.find({ status: "active" }).sort(sorted).select("name fileName fileSize orderBy").lean();

/** Admin: every item, with who added / last updated it */
export const listDownloadsService = () =>
  Download.find().sort(sorted).populate("addedBy", AUDIT_FIELDS).populate("updatedBy", AUDIT_FIELDS).lean();

export const getDownloadService = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.notFound("Download not found.");
  const item = await Download.findById(id);
  if (!item) throw ApiError.notFound("Download not found.");
  return item;
};

/** Website: the active item whose PDF is being downloaded */
export const getActiveDownloadService = async (id: string) => {
  const item = await getDownloadService(id);
  if (item.status !== "active") throw ApiError.notFound("This file is no longer available.");
  return item;
};

/** Checks the text fields of a create (all required) or update (only those sent) */
const readPayload = async (body: Record<string, unknown>, partial: boolean, excludeId?: string) => {
  const data: { name?: string; status?: DownloadStatus; orderBy?: number } = {};
  const errors: string[] = [];
  const sent = (field: string) => !partial || (body[field] !== undefined && body[field] !== "");

  if (sent("name")) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name) errors.push("Name is required.");
    else if (name.length < 2 || name.length > DOWNLOAD_LIMITS.name) errors.push(`Name must be 2–${DOWNLOAD_LIMITS.name} characters.`);
    else {
      const duplicate = await Download.exists({
        name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      });
      if (duplicate) errors.push(`A download named "${name}" already exists.`);
    }
    data.name = name;
  }

  if (sent("status")) {
    const status = String(body.status ?? "active").trim().toLowerCase();
    if (!DOWNLOAD_STATUSES.includes(status as DownloadStatus)) errors.push("Status must be active or inactive.");
    else data.status = status as DownloadStatus;
  }

  if (sent("orderBy")) {
    const raw = body.orderBy;
    const orderBy = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    if (String(raw ?? "").trim() === "" || !Number.isInteger(orderBy) || orderBy < 0 || orderBy > DOWNLOAD_LIMITS.orderBy) {
      errors.push(`Order must be a whole number from 0 to ${DOWNLOAD_LIMITS.orderBy}.`);
    } else data.orderBy = orderBy;
  }

  if (errors.length) throw ApiError.badRequest(errors[0], errors);
  return data;
};

const checkPdf = (file: UploadedPdf) => {
  if (!file.size) throw ApiError.badRequest("This PDF is empty.");
  if (!isPdfBuffer(file.buffer)) throw ApiError.badRequest("This file is not a valid PDF.");
};

/** Stores the PDF and returns the fields to save on the record */
const storeFile = async (file: UploadedPdf) => ({
  fileUrl: await storePdf(file.buffer),
  fileName: file.originalName.slice(0, 200),
  fileSize: file.size,
  fileFormat: "pdf" as const,
});

const withAudit = (id: string) =>
  Download.findById(id).populate("addedBy", AUDIT_FIELDS).populate("updatedBy", AUDIT_FIELDS).lean();

const adminRef = (adminId?: string) => (adminId && isValidObjectId(adminId) ? adminId : null);

export const createDownloadService = async (body: Record<string, unknown>, file: UploadedPdf | undefined, adminId?: string) => {
  if (!file) throw ApiError.badRequest("Please upload a PDF file.");
  checkPdf(file);
  const data = await readPayload(body, false);
  if (data.orderBy === undefined) {
    const last = await Download.findOne().sort({ orderBy: -1 }).select("orderBy").lean();
    data.orderBy = (last?.orderBy ?? 0) + 1;
  }

  // The file is stored only after everything else checked out
  const fields = await storeFile(file);
  try {
    const admin = adminRef(adminId);
    const item = await Download.create({ ...data, ...fields, addedBy: admin, updatedBy: admin });
    return withAudit(String(item._id));
  } catch (err) {
    await removeStoredPdf(fields.fileUrl);
    throw err;
  }
};

export const updateDownloadService = async (id: string, body: Record<string, unknown>, file: UploadedPdf | undefined, adminId?: string) => {
  const item = await getDownloadService(id);
  if (file) checkPdf(file);
  const data = await readPayload(body, true, id);

  const oldFileUrl = item.fileUrl;
  const fields = file ? await storeFile(file) : null;
  try {
    Object.assign(item, data, fields ?? {});
    const admin = adminRef(adminId);
    if (admin) item.set("updatedBy", admin);
    await item.save();
  } catch (err) {
    if (fields) await removeStoredPdf(fields.fileUrl);
    throw err;
  }
  // The new PDF is saved; the replaced one is no longer used
  if (fields && oldFileUrl !== fields.fileUrl) await removeStoredPdf(oldFileUrl);
  return withAudit(id);
};

export const deleteDownloadService = async (id: string) => {
  const item = await getDownloadService(id);
  await item.deleteOne();
  await removeStoredPdf(item.fileUrl);
};
