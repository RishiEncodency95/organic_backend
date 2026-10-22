import jpeg from "jpeg-js";
import { PNG } from "pngjs";

/*
 * Small image helpers for the careers emails. Outlook (Windows) ignores CSS sizing such as
 * height:auto and object-fit, so every image gets exact pixel sizes and the candidate photo
 * is cropped to the frame before it is embedded.
 */

/** Pixel size of a PNG or JPEG, or null */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0–SOF15 (not DHT / JPG / DAC) carry the size
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

type Pixels = { width: number; height: number; data: Buffer | Uint8Array };

function decode(buf: Buffer, mime: string): Pixels | null {
  try {
    if (/png/i.test(mime)) return PNG.sync.read(buf);
    if (/jpe?g/i.test(mime)) return jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
  } catch {
    /* unreadable image: caller keeps the original */
  }
  return null;
}

/**
 * The photo cropped to fill a width × height frame (like object-fit: cover, kept towards
 * the top so faces are not cut), as a JPEG. Returns null when the image cannot be read.
 */
export function coverCrop(buf: Buffer, mime: string, width: number, height: number): Buffer | null {
  const src = decode(buf, mime);
  if (!src || !src.width || !src.height) return null;
  const scale = Math.max(width / src.width, height / src.height);
  const cropW = width / scale;
  const cropH = height / scale;
  const left = (src.width - cropW) / 2;
  const top = Math.max(0, (src.height - cropH) * 0.2);
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // average the source pixels that land on this output pixel (simple box filter)
      const x0 = Math.floor(left + x / scale), x1 = Math.max(x0 + 1, Math.floor(left + (x + 1) / scale));
      const y0 = Math.floor(top + y / scale), y1 = Math.max(y0 + 1, Math.floor(top + (y + 1) / scale));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < src.height; sy++)
        for (let sx = x0; sx < x1 && sx < src.width; sx++) {
          const i = (sy * src.width + sx) * 4;
          const a = src.data[i + 3] / 255;
          r += src.data[i] * a + 255 * (1 - a);
          g += src.data[i + 1] * a + 255 * (1 - a);
          b += src.data[i + 2] * a + 255 * (1 - a);
          n++;
        }
      const o = (y * width + x) * 4;
      out[o] = r / (n || 1);
      out[o + 1] = g / (n || 1);
      out[o + 2] = b / (n || 1);
      out[o + 3] = 255;
    }
  }
  return Buffer.from(jpeg.encode({ width, height, data: out }, 88).data);
}
