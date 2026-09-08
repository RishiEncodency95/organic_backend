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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
