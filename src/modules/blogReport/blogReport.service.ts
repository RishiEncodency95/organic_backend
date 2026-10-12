import { isValidObjectId } from "mongoose";
import BlogReport, { BLOG_REPORT_STATUSES } from "../../models/blog/blogReport.model";
import { ApiError } from "../../utils/ApiError";
import { seedOnce } from "../../utils/seedOnce";

export const BLOG_REPORT_LIMITS = { title: 100, description: 200, maxFileMB: 25 } as const;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max + 1) : "");

/** The Cloudinary PDF behind a stored link (our /api/files/pdf proxy or the CDN URL itself) */
const cloudinaryPdf = (link: string): string | null => {
  let target = link;
  const proxy = link.match(/^(?:https?:\/\/[^/]+)?\/api\/files\/pdf\?url=([^&\s]+)$/i);
  if (proxy) {
    try {
      target = decodeURIComponent(proxy[1]);
    } catch {
      return null;
    }
  }
  return /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/(image|raw)\/upload\/[^\s?#]+\.pdf$/i.test(target) ? target : null;
};

/** The reports the website listed before they were managed here (no PDFs existed for them) */
const STARTER = [
  "Organic Industry Report 2026",
  "India Organic Market Outlook",
  "Organic Certification Guide",
  "Sustainable Packaging Trends",
  "Organic Export Opportunities",
];

const ensureSeeded = () =>
  seedOnce("blog-reports", BlogReport, async () => {
    await BlogReport.insertMany(STARTER.map((title, i) => ({ title, fileUrl: "", fileSize: 0, order: i + 1 })));
  });

/** Website: published reports in order. Only whether a PDF exists is shared — not its link
 *  (downloads go through /:id/download) and not the download counts. */
export const listPublicBlogReportsService = async () => {
  await ensureSeeded();
  const reports = await BlogReport.find({ status: "published" }).sort({ order: 1, createdAt: -1 }).select("title description fileSize fileUrl order").lean();
  return reports.map(({ fileUrl, ...r }) => ({ ...r, fileSize: fileUrl ? r.fileSize : 0, hasFile: Boolean(fileUrl) }));
};

/** Admin: every report */
export const listBlogReportsService = async () => {
  await ensureSeeded();
  return BlogReport.find().sort({ order: 1, createdAt: -1 }).lean();
};

const readPayload = (body: Record<string, unknown>, partial: boolean) => {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const need = (field: string) => !partial || body[field] !== undefined;
  const L = BLOG_REPORT_LIMITS;

  if (need("title")) {
    const title = text(body.title, L.title);
    if (!title) errors.push("Report title is required.");
    else if (title.length < 3 || title.length > L.title) errors.push(`Report title must be 3–${L.title} characters.`);
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = text(body.description, L.description);
    if (description.length > L.description) errors.push(`Short description can be at most ${L.description} characters.`);
    data.description = description;
  }
  // The PDF is optional: without one the website lists the report as "Coming soon"
  if (body.fileUrl !== undefined) {
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl && (fileUrl.length > 2000 || !cloudinaryPdf(fileUrl))) errors.push("The file must be a PDF uploaded here.");
    data.fileUrl = fileUrl;
    if (!fileUrl) {
      data.fileName = "";
      data.fileSize = 0;
    }
  }
  if (body.fileName !== undefined && data.fileUrl !== "") data.fileName = text(body.fileName, 150).slice(0, 150);
  if (body.fileSize !== undefined && data.fileUrl !== "") {
    const size = Number(body.fileSize);
    if (!Number.isFinite(size) || size <= 0) errors.push("File size is missing.");
    else if (size > L.maxFileMB * 1024 * 1024) errors.push(`The PDF can be at most ${L.maxFileMB} MB.`);
    data.fileSize = Math.round(size);
  }
  if (body.status !== undefined) {
    if (!BLOG_REPORT_STATUSES.includes(body.status as never)) errors.push("Status must be published or hidden.");
    data.status = body.status;
  }
  if (body.order !== undefined && body.order !== "") {
    const order = Number(body.order);
    if (!Number.isInteger(order) || order < 0 || order > 9999) errors.push("Order must be a whole number from 0 to 9999.");
    data.order = order;
  }
  if (errors.length) throw new ApiError(400, errors[0], errors);
  return data;
};

export const createBlogReportService = async (body: Record<string, unknown>) => {
  await ensureSeeded();
  const data = readPayload(body ?? {}, false);
  if (data.order === undefined) {
    const last = await BlogReport.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order ?? 0) + 1;
  }
  return BlogReport.create(data);
};

const findOr404 = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid report id.");
  const doc = await BlogReport.findById(id);
  if (!doc) throw ApiError.notFound("Report not found.");
  return doc;
};

export const updateBlogReportService = async (id: string, body: Record<string, unknown>) => {
  const doc = await findOr404(id);
  doc.set(readPayload(body ?? {}, true));
  await doc.save();
  return doc;
};

export const deleteBlogReportService = async (id: string) => {
  const doc = await findOr404(id);
  await doc.deleteOne();
  return doc;
};

/**
 * Website download: counts it and returns where the browser should go — the PDF proxy,
 * asked to save the file under the report's title.
 */
export const downloadBlogReportService = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.notFound("Report not found.");
  const doc = await BlogReport.findOne({ _id: id, status: "published" }).select("title fileUrl").lean();
  if (!doc) throw ApiError.notFound("Report not found.");
  const pdf = doc.fileUrl ? cloudinaryPdf(doc.fileUrl) : null;
  if (!pdf) throw ApiError.notFound("This report is not available to download yet.");
  await BlogReport.updateOne({ _id: id }, { $inc: { downloads: 1 } });
  return `/api/files/pdf?url=${encodeURIComponent(pdf)}&download=1&name=${encodeURIComponent(doc.title)}`;
};
