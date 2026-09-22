const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

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

    if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        if (result.value && result.value.trim()) {
          return result.value.trim();
        }
      } catch (docErr) {
        console.warn("Mammoth DOCX extraction warning:", docErr);
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
