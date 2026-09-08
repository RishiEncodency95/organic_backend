import winston from "winston";
import { env } from "../config/env";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "warn" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    // Formatted colorful logs in console
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    }),
    // Save error level logs to file
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    // Save all logs to combined file
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});
