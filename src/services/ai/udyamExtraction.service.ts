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
  gstin: string | null;
  pan: string | null;
  constitution: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  bankAccountNumber: string | null;
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
  "nicCode": "Primary NIC code exactly as printed, or null",
  "gstin": "The full 15-character GSTIN exactly as printed (format 22AAAAA0000A1Z5), or null. A 'GSTIN registered: Yes/No' flag is NOT a GSTIN — return null for that",
  "pan": "The full 10-character PAN exactly as printed (format AAAAA0000A), or null. Udyam certificates often mask it (e.g. 'AAXXX1234X' or 'XXXXX1234X') — return null for anything masked or partially hidden, never reconstruct it",
  "constitution": "The 'Type of Organisation' / constitution exactly as one of: 'Proprietorship', 'Partnership', 'LLP', 'Private Limited Company', 'Public Limited Company'. Map the certificate's wording onto the closest of those five (e.g. 'Private Limited Company' for 'PRIVATE LIMITED COMPANY'), or null if it is not printed. Never infer it from the enterprise's name",
  "bankName": "Bank name from the 'Bank Details' section exactly as printed, or null",
  "bankIfsc": "The 11-character IFS code from the 'Bank Details' section (format SBIN0000642), or null. These fields are printed run together in the extracted text (e.g. 'STATE BANK OF INDIASBIN000064255145993685') — split them on the IFSC's fixed shape of 4 letters, then '0', then 6 more characters",
  "bankAccountNumber": "The bank account number from the 'Bank Details' section, digits only, or null. It is whatever follows the IFS code in that run-together text"
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

NOTE ON FORMATTING: this text comes from a PDF table, so labels and values are run
together with no separator and a value is often immediately followed by the next label
(e.g. "GenderMaleSpecially Abled(DIVYANG)No" means Gender = Male, and
"Social CategorySC" means Social Category = SC). Read values by their label, not by
whitespace, and do not let a trailing label bleed into the value you return.

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

  // Cheap model first; the stronger one is only paid for when that actually fails, which
  // keeps a bad day on one model from dropping the whole read to the heuristic fallback.
  const models = ["gpt-4o-mini", "gpt-4o"];

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.imageBase64
    ? [
        { type: "text", text: buildImagePrompt() },
        {
          type: "image_url",
          image_url: { url: `data:${input.imageMimeType || "image/jpeg"};base64,${input.imageBase64}` },
        },
      ]
    : [{ type: "text", text: buildTextPrompt(input.text || "") }];

  let lastError = "no model attempted";

  for (const model of models) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        // Transcription, not generation: any randomness here means the same certificate
        // reads differently on two runs, which is exactly how a printed field ends up
        // filled on one upload and blank on the next.
        temperature: 0,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        lastError = `${model}: empty response`;
        continue;
      }
      return JSON.parse(content) as UdyamExtractedData;
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
      console.warn(`Udyam OpenAI extraction failed on ${lastError}`);
    }
  }

  throw new Error(`OpenAI extraction failed — ${lastError}`);
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

  // gemini-1.5-flash was retired on the Gemini API and now 404s, which silently turned
  // this whole fallback into dead weight. Newest first, so a model being retired again
  // costs one wasted request rather than the entire fallback.
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let lastError = "no model attempted";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      lastError = `${model}: ${response.status} ${(await response.text()).slice(0, 200)}`;
      console.warn(`Udyam Gemini extraction failed on ${lastError}`);
      continue;
    }

    const resData = (await response.json()) as any;
    const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      lastError = `${model}: empty response`;
      continue;
    }

    const cleanedJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanedJson) as UdyamExtractedData;
  }

  throw new Error(`Gemini API error: ${lastError}`);
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * The certificate prints bank name, IFSC and account number run together
 * ("STATE BANK OF INDIASBIN000064255145993685"), and the model splits that boundary a
 * character off — returning a correct IFSC but an account number carrying the IFSC's
 * last digit. An IFSC has a fixed shape, so once it is located in the source text the
 * account number is simply the digits that follow it. Deterministic beats re-prompting:
 * a payout account that is silently one digit wrong is worse than none at all.
 */
const repairBankAccountNumber = (data: UdyamExtractedData, sourceText: string): UdyamExtractedData => {
  const ifsc = data.bankIfsc?.trim().toUpperCase() || "";
  if (!sourceText || !IFSC_RE.test(ifsc)) return data;

  const index = sourceText.toUpperCase().indexOf(ifsc);
  if (index === -1) return data;

  const digits = sourceText.slice(index + ifsc.length).match(/^\d+/)?.[0];
  if (!digits) return data;

  if (digits !== data.bankAccountNumber) {
    console.log(`🏦 [Udyam] Bank account corrected from model split: ${data.bankAccountNumber} -> ${digits}`);
  }
  return { ...data, bankIfsc: ifsc, bankAccountNumber: digits };
};

/**
 * Gender is printed run together with the next label ("GenderMaleSpecially Abled"), and
 * the model reads that inconsistently — the same certificate yields "Male" on one run and
 * null on another. It has only a few possible values, so where the model came back empty
 * the text itself settles it. Only ever fills a gap; a value the model did return stands.
 */
const repairGender = (data: UdyamExtractedData, sourceText: string): UdyamExtractedData => {
  if (data.gender || !sourceText) return data;

  const match = sourceText.match(/Gender(?:\s+of\s+Entrepreneur)?\s*:?\s*(Male|Female)/i);
  if (!match) return data;

  const gender = match[1].toLowerCase() === "male" ? "Male" : "Female";
  console.log(`👤 [Udyam] Gender recovered from certificate text: ${gender}`);
  return { ...data, gender };
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
    gstin: null,
    pan: null,
    constitution: null,
    bankName: null,
    bankIfsc: null,
    bankAccountNumber: null,
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
          gstin: null,
          pan: null,
          constitution: null,
          bankName: null,
          bankIfsc: null,
          bankAccountNumber: null,
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
    return { data: repairGender(repairBankAccountNumber(data, extractedText), extractedText), provider: "OpenAI" };
  } catch (openaiErr) {
    console.warn("Udyam OpenAI extraction failed, trying Gemini:", (openaiErr as Error).message);
  }

  try {
    const data = await extractUdyamWithGemini(input);
    return { data: repairGender(repairBankAccountNumber(data, extractedText), extractedText), provider: "Gemini" };
  } catch (geminiErr) {
    console.warn("Udyam Gemini extraction failed, falling back to heuristic:", (geminiErr as Error).message);
  }

  return { data: extractUdyamHeuristic(extractedText), provider: "Heuristic" };
};
