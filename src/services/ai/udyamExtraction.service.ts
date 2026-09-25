import OpenAI from "openai";
const pdfParse = require("pdf-parse");

export interface UdyamExtractedData {
  documentType: "valid_udyam_certificate" | "unclear" | "not_a_udyam_certificate";
  udyamRegistrationNumber: string | null;
  enterpriseName: string | null;
  enterpriseType: "Micro" | "Small" | "Medium" | null;
  majorActivity: "Manufacturing" | "Services" | "Trading" | null;
  socialCategory: "General" | "OBC" | "SC" | "ST" | null;
  gender: "Male" | "Female" | null;
  dateOfIncorporation: string | null;
  dateOfUdyamRegistration: string | null;
  address: string | null;
  state: string | null;
  district: string | null;
  pincode: string | null;
  mobile: string | null;
  email: string | null;
  nicCode: string | null;
}

const RESPONSE_SCHEMA_TEXT = `{
  "documentType": "'valid_udyam_certificate' if this is genuinely a Udyam Registration Certificate, 'unclear' if the document is unreadable/ambiguous, or 'not_a_udyam_certificate' if it is clearly some other document",
  "udyamRegistrationNumber": "The Udyam Registration Number exactly as printed, format UDYAM-XX-00-0000000, or null",
  "enterpriseName": "The registered enterprise/business name exactly as printed, or null",
  "enterpriseType": "'Micro', 'Small', or 'Medium' exactly as classified on the certificate, or null",
  "majorActivity": "'Manufacturing', 'Services', or 'Trading' — the major activity type stated on the certificate, or null",
  "socialCategory": "'General', 'OBC', 'SC', or 'ST' if explicitly printed, or null",
  "gender": "'Male' or 'Female' ONLY if an explicit gender field is printed for the entrepreneur, never guessed from the name, otherwise null",
  "dateOfIncorporation": "Date of incorporation/commencement of business exactly as printed, or null",
  "dateOfUdyamRegistration": "Date of Udyam Registration exactly as printed, or null",
  "address": "Registered office / plant address exactly as printed, or null",
  "state": "State exactly as printed, or null",
  "district": "District exactly as printed, or null",
  "pincode": "6-digit PIN code, or null",
  "mobile": "Registered mobile number exactly as printed, or null",
  "email": "Registered email address exactly as printed, or null",
  "nicCode": "Primary NIC code exactly as printed, or null"
}`;

const SYSTEM_PROMPT =
  "You are a precise, unbiased JSON-only document reader for Udyam Registration Certificates issued by the Ministry of MSME, Government of India. " +
  "NEVER invent or hallucinate a value. If a field is not clearly and explicitly present in the document, return null for it. " +
  "Do not guess or estimate eligibility, support percentages, or any scheme benefit — that is out of scope; only transcribe what is printed on the certificate.";

const buildTextPrompt = (docText: string) => `Read the following text, extracted from an uploaded document that is claimed to be a Udyam Registration Certificate, and extract the fields below.

DOCUMENT TEXT:
"""
${docText}
"""

Return ONLY a strictly valid JSON object with EXACTLY this structure:
${RESPONSE_SCHEMA_TEXT}`;

const buildImagePrompt = () => `This image is an uploaded document, claimed to be a Udyam Registration Certificate. Read it carefully and extract the fields below.

Return ONLY a strictly valid JSON object with EXACTLY this structure:
${RESPONSE_SCHEMA_TEXT}`;

export interface UdyamDocumentInput {
  /** Set when the file is a text-extractable PDF. */
  text?: string;
  /** Set when the file is an image (or an image-only/scanned PDF) — base64, no data: prefix. */
  imageBase64?: string;
  imageMimeType?: string;
}

export const extractUdyamWithOpenAI = async (input: UdyamDocumentInput): Promise<UdyamExtractedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.imageBase64
    ? [
        { type: "text", text: buildImagePrompt() },
        {
          type: "image_url",
          image_url: { url: `data:${input.imageMimeType || "image/jpeg"};base64,${input.imageBase64}` },
        },
      ]
    : [{ type: "text", text: buildTextPrompt(input.text || "") }];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content) as UdyamExtractedData;
};

export const extractUdyamWithGemini = async (input: UdyamDocumentInput): Promise<UdyamExtractedData> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const parts: any[] = input.imageBase64
    ? [
        { text: buildImagePrompt() },
        { inline_data: { mime_type: input.imageMimeType || "image/jpeg", data: input.imageBase64 } },
      ]
    : [{ text: buildTextPrompt(input.text || "") }];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const resData = (await response.json()) as any;
  const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error("Empty response from Gemini API");

  const cleanedJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleanedJson) as UdyamExtractedData;
};

const UDYAM_NUMBER_RE = /UDYAM-[A-Z]{2}-\d{2}-\d{7}/i;

/** Zero-AI-cost last resort: pulls the one field a regex can reliably find in raw text. */
const extractUdyamHeuristic = (text: string): UdyamExtractedData => {
  const match = text.match(UDYAM_NUMBER_RE);
  return {
    documentType: match ? "unclear" : "not_a_udyam_certificate",
    udyamRegistrationNumber: match ? match[0].toUpperCase() : null,
    enterpriseName: null,
    enterpriseType: null,
    majorActivity: null,
    socialCategory: null,
    gender: null,
    dateOfIncorporation: null,
    dateOfUdyamRegistration: null,
    address: null,
    state: null,
    district: null,
    pincode: null,
    mobile: null,
    email: null,
    nicCode: null,
  };
};

/**
 * Reads an uploaded certificate file (PDF or image) and extracts structured Udyam
 * fields, in the same OpenAI -> Gemini -> deterministic-fallback order the CV
 * analysis pipeline uses, so a provider outage never hard-fails the upload.
 */
export const runUdyamExtractionPipeline = async (
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ data: UdyamExtractedData; provider: "OpenAI" | "Gemini" | "Heuristic" }> => {
  const lowerName = fileName.toLowerCase();
  const isPdf = mimeType.includes("pdf") || lowerName.endsWith(".pdf");

  let input: UdyamDocumentInput;
  let extractedText = "";

  if (isPdf) {
    try {
      const parseFn = typeof pdfParse === "function" ? pdfParse : pdfParse.default || pdfParse.PdfParse;
      const parsed = typeof parseFn === "function" ? await parseFn(fileBuffer) : null;
      extractedText = (parsed?.text || "").trim();
    } catch (err) {
      console.warn("Udyam PDF text extraction warning:", err);
    }

    // A scanned/image-only PDF yields little to no selectable text. Vision models
    // don't accept raw PDF bytes as an image, so there's no reliable path forward —
    // ask for a clearer copy instead of sending garbage to an AI call.
    if (extractedText.length <= 40) {
      return {
        data: {
          documentType: "unclear",
          udyamRegistrationNumber: null,
          enterpriseName: null,
          enterpriseType: null,
          majorActivity: null,
          socialCategory: null,
          gender: null,
          dateOfIncorporation: null,
          dateOfUdyamRegistration: null,
          address: null,
          state: null,
          district: null,
          pincode: null,
          mobile: null,
          email: null,
          nicCode: null,
        },
        provider: "Heuristic",
      };
    }
    input = { text: extractedText };
  } else {
    input = { imageBase64: fileBuffer.toString("base64"), imageMimeType: mimeType };
  }

  try {
    const data = await extractUdyamWithOpenAI(input);
    return { data, provider: "OpenAI" };
  } catch (openaiErr) {
    console.warn("Udyam OpenAI extraction failed, trying Gemini:", (openaiErr as Error).message);
  }

  try {
    const data = await extractUdyamWithGemini(input);
    return { data, provider: "Gemini" };
  } catch (geminiErr) {
    console.warn("Udyam Gemini extraction failed, falling back to heuristic:", (geminiErr as Error).message);
  }

  return { data: extractUdyamHeuristic(extractedText), provider: "Heuristic" };
};
