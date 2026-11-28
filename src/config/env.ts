import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Validate all environment variables at startup — server will exit if any required variable is missing
const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRE: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),
  REFRESH_TOKEN_EXPIRE: z.string().default("7d"),
  TOTP_APP_NAME: z.string().default("OrganicAdmin"),
  ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_SECRET: z.string().min(1, "COOKIE_SECRET is required"),

  // AI Keys
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  // Website chatbot: comma-separated origins allowed to call /api/chat (empty = any)
  ALLOWED_ORIGINS: z.string().default(""),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // SMTP Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().optional(),
  FROM_NAME: z.string().optional(),
  // SEO & Google Keys
  PAGESPEED_API_KEY: z.string().optional(),
  PSI_API_KEY: z.string().optional(),
  GOOGLE_CSE_API_KEY: z.string().optional(),
  GOOGLE_CSE_ID: z.string().optional(),
  API_PUBLIC_URL: z.string().optional(),
  WEBSITE_BUILD_HOOK_URL: z.string().optional(),
  SEO_DEFAULT_OG_IMAGE: z.string().optional(),
  SEO_WEBHOOK_API_KEY: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),
  SEARCH_CONSOLE_SITE_URL: z.string().optional(),
  GSC_SITE_URL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  GSC_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GSC_OAUTH_CLIENT_ID: z.string().optional(),
  GSC_OAUTH_CLIENT_SECRET: z.string().optional(),
  GSC_OAUTH_REFRESH_TOKEN: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  WEBSITE_URL: z.string().optional(),
  LIVE_SITE_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),

  // Website cache refresh after admin saves (frontend app/api/revalidate). Both optional:
  // without them the website picks up admin changes within its 60s cache window.
  FRONTEND_URL: z.string().optional(),
  REVALIDATE_SECRET: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

