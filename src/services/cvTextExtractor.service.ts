const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** One line per line, no runs of blank lines or stray spaces */
const tidy = (s: string) =>
  s
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

export const extractTextFromCv = async (
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> => {
  try {
    const lowerName = fileName.toLowerCase();
    const isPdf = mimeType.includes("pdf") || lowerName.endsWith(".pdf");
    const isDocx = mimeType.includes("word") || lowerName.endsWith(".docx") || lowerName.endsWith(".doc");

    if (isPdf) {
      const parseFn = typeof pdfParse === "function" ? pdfParse : pdfParse.default || pdfParse.PdfParse;
      if (typeof parseFn === "function") {
        const data = await parseFn(fileBuffer);
        return (data.text || "").trim();
      }
    }

    // Old binary Word (.doc) files are OLE containers (D0 CF 11 E0), which mammoth cannot read
    const isOle = fileBuffer.length > 8 && fileBuffer.readUInt32BE(0) === 0xd0cf11e0;
    if (isOle) {
      try {
        const doc = await new WordExtractor().extract(fileBuffer);
        const text = [doc.getHeaders?.({ includeFooters: false }), doc.getBody()].filter(Boolean).join("\n");
        if (text.trim()) return tidy(text);
      } catch (docErr) {
        console.warn("DOC extraction warning:", (docErr as Error).message);
      }
    } else if (isDocx) {
      try {
        // Via HTML so line breaks inside a paragraph (Shift+Enter) stay separate lines —
        // raw text glues "Company" and "Mar 2022 – Present" together
        const { value } = await mammoth.convertToHtml({ buffer: fileBuffer });
        const text = decodeEntities(
          String(value || "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
            .replace(/<\/t[dh]>/gi, " | ")
            .replace(/<[^>]+>/g, "")
        );
        if (text.trim()) return tidy(text);
      } catch (docErr) {
        console.warn("Mammoth DOCX extraction warning:", (docErr as Error).message);
      }
    }

    // For plain text, or fallback UTF-8 parsing
    const rawText = fileBuffer.toString("utf-8");
    const cleanedText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ").trim();
    return cleanedText;
  } catch (error) {
    console.error("Error extracting text from CV:", error);
    return fileBuffer.toString("latin1").replace(/[\x00-\x1F\x7F-\x9F]/g, " ").trim();
  }
};
