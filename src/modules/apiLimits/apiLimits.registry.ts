/**
 * Website APIs that the IP block limit protects. `paths` match the request path after
 * /api (or /api/v1); only the given method counts. Defaults apply until an admin changes
 * the rule in IP Block Limits.
 */
export interface ProtectedApi {
  key: string;
  label: string;
  method: "POST" | "PUT" | "PATCH";
  paths: RegExp[];
  /** Shown to the admin, e.g. "/contact-enquiry" */
  display: string;
  maxAttempts: number;
  blockHours: number;
}

const DEFAULT_HOURS = 24;

export const PROTECTED_APIS: ProtectedApi[] = [
  { key: "resume-upload", label: "Resume Upload", method: "POST", paths: [/^\/careers\/cv\/upload\/?$/], display: "/careers/cv/upload", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  { key: "job-application", label: "Job Application", method: "POST", paths: [/^\/careers\/applications\/?$/], display: "/careers/applications", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  {
    key: "contact-enquiry",
    label: "Contact Enquiry",
    method: "POST",
    paths: [/^\/contact-enquiry\/?$/, /^\/website\/contact-enquiry\/?$/, /^\/website\/contact\/?$/],
    display: "/contact-enquiry",
    maxAttempts: 3,
    blockHours: DEFAULT_HOURS,
  },
  { key: "partnership-enquiry", label: "Partnership Enquiry", method: "POST", paths: [/^\/partnership-enquiry\/?$/], display: "/partnership-enquiry", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  { key: "buyer-enquiry", label: "Buyer Enquiry", method: "POST", paths: [/^\/buyer-enquiries\/?$/], display: "/buyer-enquiries", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  {
    key: "visitor-registration",
    label: "Visitor Registration",
    method: "POST",
    paths: [/^\/(general|corporate|group|international|health-camp)-visitors\/?$/],
    display: "/general-visitors, /corporate-visitors …",
    maxAttempts: 3,
    blockHours: DEFAULT_HOURS,
  },
  { key: "exhibitor-registration", label: "Exhibitor Registration (Book a Stand)", method: "POST", paths: [/^\/exhibitor-registration\/?$/], display: "/exhibitor-registration", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  { key: "award-nomination", label: "Award Nomination", method: "POST", paths: [/^\/website\/awards\/nominations\/?$/], display: "/website/awards/nominations", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  { key: "msme-application", label: "MSME Application", method: "POST", paths: [/^\/msme\/applications\/?$/], display: "/msme/applications", maxAttempts: 3, blockHours: DEFAULT_HOURS },
  // Every form above verifies by OTP first, so the OTP rules allow a few more sends
  { key: "phone-otp", label: "Phone OTP (WhatsApp)", method: "POST", paths: [/^\/(website\/)?verify\/send-phone-otp\/?$/], display: "/verify/send-phone-otp", maxAttempts: 5, blockHours: DEFAULT_HOURS },
  { key: "email-otp", label: "Email OTP", method: "POST", paths: [/^\/(website\/)?verify\/send-email-otp\/?$/], display: "/verify/send-email-otp", maxAttempts: 5, blockHours: DEFAULT_HOURS },
  // One visitor can send the details form, a quotation and a callback in one chat
  { key: "chat-lead", label: "Chatbot Lead", method: "POST", paths: [/^\/chat\/lead\/?$/], display: "/chat/lead", maxAttempts: 5, blockHours: DEFAULT_HOURS },
];

export const findProtectedApi = (method: string, apiPath: string) =>
  PROTECTED_APIS.find((api) => api.method === method && api.paths.some((re) => re.test(apiPath)));

export const protectedApiByKey = (key: string) => PROTECTED_APIS.find((api) => api.key === key);
