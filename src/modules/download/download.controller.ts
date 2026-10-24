import { NextFunction, Request, Response } from "express";
import multer from "multer";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import { sendStoredPdf } from "./download.storage";
import {
  createDownloadService,
  deleteDownloadService,
  getActiveDownloadService,
  getDownloadService,
  listDownloadsService,
  listPublicDownloadsService,
  updateDownloadService,
  type UploadedPdf,
} from "./download.service";

export const MAX_PDF_MB = 20;

// Kept in memory (max 20 MB) so the PDF can be checked before it is stored anywhere
const pdfUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" && /\.pdf$/i.test(file.originalname);
    if (isPdf) cb(null, true);
    else cb(ApiError.badRequest("Only PDF files are allowed."));
  },
});

/** Accepts one optional PDF in the "file" field and turns upload errors into clear 400s */
export const uploadPdf = (req: Request, res: Response, next: NextFunction) => {
  pdfUploader.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err instanceof multer.MulterError) {
      return next(
        ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? `The PDF must be ${MAX_PDF_MB} MB or smaller.` : `Upload failed: ${err.message}`)
      );
    }
    next(ApiError.badRequest((err as Error)?.message || "The PDF could not be uploaded."));
  });
};

const uploadedPdf = (req: Request): UploadedPdf | undefined =>
  req.file ? { buffer: req.file.buffer, originalName: req.file.originalname, size: req.file.size } : undefined;

// GET /api/downloads — website: active PDFs in order
export const getPublicDownloads = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Downloads", await listPublicDownloadsService()));
});

// GET /api/downloads/:id/file — website: saves the PDF (active items only)
export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const item = await getActiveDownloadService(String(req.params.id));
  await sendStoredPdf(res, item.fileUrl, { download: req.query.view !== "1", name: item.name });
});

// GET /api/downloads/:id/admin-file — admin: opens any item's PDF, active or not
export const viewFileAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const item = await getDownloadService(String(req.params.id));
  res.setHeader("Cache-Control", "private, no-store");
  await sendStoredPdf(res, item.fileUrl, { download: false, name: item.name });
});

// GET /api/downloads/admin — admin: every item
export const getDownloads = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Downloads", await listDownloadsService()));
});

// POST /api/downloads — multipart: name, status, orderBy, file (PDF)
export const createDownload = asyncHandler(async (req: Request, res: Response) => {
  const item = await createDownloadService(req.body ?? {}, uploadedPdf(req), req.user?.id);
  revalidateWebsite();
  res.status(201).json(new ApiResponse(201, "Download added", item));
});

// PUT/PATCH /api/downloads/:id — multipart or JSON; the file is optional
export const updateDownload = asyncHandler(async (req: Request, res: Response) => {
  const item = await updateDownloadService(String(req.params.id), req.body ?? {}, uploadedPdf(req), req.user?.id);
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Download updated", item));
});

export const deleteDownload = asyncHandler(async (req: Request, res: Response) => {
  await deleteDownloadService(String(req.params.id));
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Download deleted", { deleted: true }));
});
