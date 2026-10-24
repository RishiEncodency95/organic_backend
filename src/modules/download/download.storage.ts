import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Response } from "express";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { parseOwnCloudinaryPdf, sendCloudinaryPdf } from "../files/files.controller";

/*
 * Where download PDFs live. The Cloudinary account is on the Free plan, which refuses files
 * over 10 MB, so:
 *   - PDFs up to 10 MB go to Cloudinary (fileUrl = its https URL)
 *   - larger ones (up to the 20 MB upload limit) are saved on this server, outside public/,
 *     so they are only reachable through /api/downloads (fileUrl = "local:<random>.pdf")
 * On a container host, mount a persistent volume at DOWNLOADS_STORAGE_DIR (default
 * <backend>/storage/downloads) or those larger files are lost on redeploy.
 */

/** Cloudinary Free plan per-file limit */
export const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;
const LOCAL_PREFIX = "local:";
const LOCAL_NAME_RE = /^[a-f0-9]{32}\.pdf$/;

const storageDir = () => path.resolve(process.env.DOWNLOADS_STORAGE_DIR || path.join(process.cwd(), "storage", "downloads"));

/** Absolute path of a locally stored PDF, or null when the stored value isn't one of ours */
const localPath = (fileUrl: string) => {
  if (!fileUrl.startsWith(LOCAL_PREFIX)) return null;
  const name = fileUrl.slice(LOCAL_PREFIX.length);
  return LOCAL_NAME_RE.test(name) ? path.join(storageDir(), name) : null;
};

/** Every real PDF starts with "%PDF-"; a renamed file doesn't */
export const isPdfBuffer = (buffer: Buffer) => buffer.length > 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";

const uploadToCloudinary = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "bharat-organic/downloads", resource_type: "auto" }, (error, result) =>
      error || !result ? reject(error || new Error("Cloudinary upload failed")) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });

const saveLocally = async (buffer: Buffer) => {
  const dir = storageDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.pdf`;
  await fs.promises.writeFile(path.join(dir, name), buffer);
  return `${LOCAL_PREFIX}${name}`;
};

/** Stores a PDF and returns the value to keep in Download.fileUrl */
export async function storePdf(buffer: Buffer): Promise<string> {
  if (buffer.length <= CLOUDINARY_MAX_BYTES && isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(buffer);
    } catch (err) {
      const message = (err as { message?: string })?.message || "Cloudinary upload failed";
      // Only a size refusal falls back to this server; any other failure is reported
      if (!/file size too large/i.test(message)) throw ApiError.badRequest(`The PDF could not be uploaded: ${message}`);
    }
  }
  return saveLocally(buffer);
}

/** Deletes a stored PDF; failures are logged, never thrown */
export async function removeStoredPdf(fileUrl?: string | null) {
  if (!fileUrl) return;
  const local = localPath(fileUrl);
  try {
    if (local) {
      await fs.promises.rm(local, { force: true });
      return;
    }
    const asset = parseOwnCloudinaryPdf(fileUrl);
    if (asset) await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType, invalidate: true });
  } catch (err) {
    logger.warn({ message: "Could not delete a download PDF", fileUrl, error: (err as Error).message });
  }
}

/** Sends a stored PDF to the browser: `download` saves it, otherwise it opens inline */
export async function sendStoredPdf(res: Response, fileUrl: string, opts: { download?: boolean; name?: string }) {
  const local = localPath(fileUrl);
  if (!local) {
    await sendCloudinaryPdf(res, fileUrl, opts);
    return;
  }

  const stat = await fs.promises.stat(local).catch(() => null);
  if (!stat?.isFile()) throw ApiError.notFound("PDF not found.");

  const wanted = String(opts.name || "")
    .replace(/\.pdf$/i, "")
    .replace(/[^\w .()&-]+/g, "")
    .trim()
    .slice(0, 100);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${opts.download ? "attachment" : "inline"}; filename="${wanted || "document"}.pdf"`);
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Cache-Control", "public, max-age=86400");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(local);
    stream.on("error", reject);
    stream.on("end", () => resolve());
    stream.pipe(res);
  });
}
