import { Readable } from "stream";
import { Request, Response } from "express";
import cloudinary from "../../config/cloudinary";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

/**
 * Parses a Cloudinary delivery URL for a PDF in THIS server's account, e.g.
 *   https://res.cloudinary.com/<cloud>/image/upload/v123/bharat-organic/brochures/abc.pdf
 *   https://res.cloudinary.com/<cloud>/raw/upload/v123/bharat-organic/brochures/abc-1.pdf
 * Anything else (other hosts, other accounts, non-PDFs) is rejected, so this can't be
 * used to fetch arbitrary URLs.
 */
function parseOwnCloudinaryPdf(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;

  const match = url.pathname.match(/^\/([^/]+)\/(image|raw)\/upload\/(?:v\d+\/)?(.+\.pdf)$/i);
  if (!match) return null;

  const [, cloudName, resourceType, assetPath] = match;
  if (cloudName !== cloudinary.config().cloud_name) return null;

  const decodedPath = decodeURIComponent(assetPath);
  return {
    resourceType: resourceType.toLowerCase() as "image" | "raw",
    // Raw public_ids keep their extension; image public_ids don't (the format is separate).
    publicId: resourceType.toLowerCase() === "raw" ? decodedPath : decodedPath.replace(/\.pdf$/i, ""),
    fileName: decodedPath.split("/").pop() || "document.pdf",
  };
}

/**
 * Streams a Cloudinary-hosted PDF to the browser so it opens inline.
 * GET /api/files/pdf?url=<cloudinary pdf url>
 *
 * Cloudinary refuses to deliver PDFs from its public CDN URLs (401) unless "Allow delivery
 * of PDF and ZIP files" is enabled on the account, so brochure links can't point at it
 * directly. The authenticated API download URL isn't subject to that restriction, so the
 * file is fetched through it here and passed through.
 */
export const streamPdf = asyncHandler(async (req: Request, res: Response) => {
  const asset = parseOwnCloudinaryPdf(String(req.query.url || ""));
  if (!asset) {
    throw ApiError.badRequest("A Cloudinary PDF URL from this site's account is required.");
  }

  const downloadUrl = cloudinary.utils.private_download_url(
    asset.publicId,
    asset.resourceType === "raw" ? "" : "pdf",
    { resource_type: asset.resourceType, type: "upload" }
  );

  const upstream = await fetch(downloadUrl);
  if (!upstream.ok || !upstream.body) {
    throw ApiError.notFound("PDF not found.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${asset.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");
  const length = upstream.headers.get("content-length");
  if (length) res.setHeader("Content-Length", length);

  Readable.fromWeb(upstream.body as any).pipe(res);
});
