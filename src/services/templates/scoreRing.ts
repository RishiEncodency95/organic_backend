import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

/*
 * The "85% Match Score" ring for the careers emails, drawn for the candidate's actual score
 * when the email is sent (email clients cannot draw a CSS ring). The digits come from small
 * letter images in assets/email/glyphs.
 */

const SIZE = 320; // drawn at 2x, shown at 112px
const OUTER = SIZE / 2 - 6;
const THICK = 26;
const TRACK: RGB = [227, 232, 227];
type RGB = [number, number, number];

const COLORS: Record<"green" | "orange" | "red", { from: RGB; to: RGB; ink: RGB }> = {
  green: { from: [14, 96, 48], to: [57, 168, 69], ink: [18, 40, 92] },
  orange: { from: [214, 104, 10], to: [246, 166, 46], ink: [214, 104, 10] },
  red: { from: [170, 24, 30], to: [232, 74, 64], ink: [170, 24, 30] },
};

const GLYPH_DIRS = [
  path.resolve(process.cwd(), "assets/email/glyphs"),
  path.resolve(__dirname, "../../../assets/email/glyphs"),
  path.resolve(__dirname, "../../../../assets/email/glyphs"),
];
const glyphs = new Map<string, PNG | null>();
const glyph = (name: string): PNG | null => {
  if (!glyphs.has(name)) {
    const dir = GLYPH_DIRS.find((d) => fs.existsSync(path.join(d, `${name}.png`)));
    glyphs.set(name, dir ? PNG.sync.read(fs.readFileSync(path.join(dir, `${name}.png`))) : null);
  }
  return glyphs.get(name) ?? null;
};

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

function blend(png: PNG, x: number, y: number, c: RGB, alpha: number) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (png.width * y + x) << 2;
  const a = Math.min(1, alpha);
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(png.data[i + k] * (1 - a) + c[k] * a);
}

/** Pastes a letter image (its alpha is the shape) in colour `c` */
function stamp(png: PNG, g: PNG, left: number, top: number, c: RGB) {
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) blend(png, left + x, top + y, c, g.data[((g.width * y + x) << 2) + 3] / 255);
}

/** PNG of the score ring with the score written inside */
export function renderScoreRing(rawScore: number): Buffer {
  const score = Math.max(0, Math.min(100, Math.round(Number(rawScore) || 0)));
  const tone = COLORS[score >= 70 ? "green" : score >= 50 ? "orange" : "red"];
  const png = new PNG({ width: SIZE, height: SIZE });
  // Same colour as the card behind it (#f7faf3), so no white square shows
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 247;
    png.data[i + 1] = 250;
    png.data[i + 2] = 243;
    png.data[i + 3] = 255;
  }
  // Inside of the ring stays white, like the design
  const hole = OUTER - THICK;

  const cx = SIZE / 2;
  const inner = OUTER - THICK;
  const sweep = score * 3.6;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cx;
      const r = Math.hypot(dx, dy);
      if (r < hole - 0.5) {
        blend(png, x, y, [255, 255, 255], 1);
        continue;
      }
      if (r < hole + 0.5) blend(png, x, y, [255, 255, 255], hole + 0.5 - r);
      const cover = Math.min(r - inner, OUTER - r) + 0.5; // soft edges
      if (cover <= 0) continue;
      // angle from 12 o'clock, clockwise, 0–360
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI + (dx < 0 ? 360 : 0);
      const color = angle <= sweep ? mix(tone.from, tone.to, sweep ? angle / sweep : 0) : TRACK;
      blend(png, x, y, color, cover);
    }
  }

  // "85%" and "Match Score" in the middle
  const parts = [...String(score)].map((d) => glyph(d)).concat(glyph("pct"));
  if (parts.every(Boolean)) {
    const width = parts.reduce((w, g) => w + (g as PNG).width - 2, 0);
    let left = Math.round(cx - width / 2);
    for (const g of parts as PNG[]) {
      stamp(png, g, left, 100, tone.ink);
      left += g.width - 2;
    }
  }
  const label = glyph("label");
  if (label) stamp(png, label, Math.round(cx - label.width / 2), 190, [30, 40, 60]);

  return PNG.sync.write(png);
}
