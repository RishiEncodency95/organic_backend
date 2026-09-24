import mammoth from "mammoth";

export interface ExtractedPhoto {
  buffer: Buffer;
  contentType: string;
}

interface Candidate extends ExtractedPhoto {
  width: number;
  height: number;
}

const MIN_SIDE = 80;
const MAX_SIDE = 2500;

/** Reads width/height off a JPEG's SOF marker (baseline or progressive, non-DHT). */
function getJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buf[offset + 1];

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Markers with no payload length to skip.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      offset += 2;
      continue;
    }

    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) break;
    offset += 2 + segmentLength;
  }

  return null;
}

/** PNG stores width/height as fixed-offset big-endian ints in the IHDR chunk. */
function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) return null;

  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function getImageDimensions(buf: Buffer, contentType: string): { width: number; height: number } | null {
  if (contentType.includes("png")) return getPngDimensions(buf);
  if (contentType.includes("jp")) return getJpegDimensions(buf);
  return getJpegDimensions(buf) || getPngDimensions(buf);
}

/**
 * Ranks a candidate image by how likely it is to be a headshot rather than a company
 * logo, icon, or decorative banner: portrait-to-square aspect ratio, sane pixel size,
 * larger byte size (icons compress to almost nothing) breaks ties.
 */
function scoreCandidate(c: Candidate): number {
  const { width, height, buffer } = c;
  if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE) return -1;

  const ratio = width / height;
  if (ratio < 0.55 || ratio > 1.6) return -1;

  const ratioScore = 1 - Math.abs(ratio - 0.8);
  return ratioScore * 1000 + buffer.length / 1000;
}

function pickBest(candidates: Candidate[]): ExtractedPhoto | null {
  let best: Candidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best ? { buffer: best.buffer, contentType: best.contentType } : null;
}

async function extractDocxPhoto(buffer: Buffer): Promise<ExtractedPhoto | null> {
  const candidates: Candidate[] = [];

  const converter = mammoth.images.imgElement(async (image) => {
    try {
      if (image.contentType?.startsWith("image/")) {
        const data = await image.readAsBuffer();
        const dims = getImageDimensions(data, image.contentType);
        if (dims) candidates.push({ buffer: data, contentType: image.contentType, ...dims });
      }
    } catch {
      // An unreadable embedded image should not fail the whole CV upload.
    }
    return { src: "" };
  });

  await mammoth.convertToHtml({ buffer }, { convertImage: converter });
  return pickBest(candidates);
}

/**
 * Resume photos are almost always embedded as a raw JPEG (DCTDecode) stream. Rather
 * than parsing the full PDF object graph, this scans directly for JPEG SOI/EOI byte
 * markers — a JPEG's own bytes are self-delimiting regardless of the surrounding PDF
 * structure, so this works without a PDF-parsing dependency.
 */
function extractPdfPhoto(buffer: Buffer): ExtractedPhoto | null {
  const candidates: Candidate[] = [];
  const soi = Buffer.from([0xff, 0xd8, 0xff]);
  const eoi = Buffer.from([0xff, 0xd9]);

  let searchFrom = 0;
  while (searchFrom < buffer.length - 4) {
    const start = buffer.indexOf(soi, searchFrom);
    if (start === -1) break;

    const end = buffer.indexOf(eoi, start + 3);
    if (end === -1) break;

    const jpegBuffer = Buffer.from(buffer.subarray(start, end + 2));
    const dims = getJpegDimensions(jpegBuffer);
    if (dims) candidates.push({ buffer: jpegBuffer, contentType: "image/jpeg", ...dims });

    searchFrom = end + 2;
  }

  return pickBest(candidates);
}

/**
 * Best-effort extraction of a headshot already embedded in the candidate's CV, so they
 * are not asked to upload one separately when their resume already has it. Legacy
 * binary .doc is not supported (mammoth only reads .docx) and simply yields null.
 */
export async function extractPhotoFromCv(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<ExtractedPhoto | null> {
  const lowerName = originalName.toLowerCase();

  try {
    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
      return extractPdfPhoto(buffer);
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      return await extractDocxPhoto(buffer);
    }
  } catch (error) {
    console.warn("⚠️ CV photo extraction failed:", (error as Error).message);
  }

  return null;
}
