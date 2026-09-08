import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import router from "./routes/index";

const app = express();

// ─── Security Middlewares ─────────────────────────────────────────────────────

// Secure HTTP headers
app.use(helmet());

// CORS configuration — allow frontend origin
const allowedOrigins = [
  env.ALLOWED_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in development
      }
    },
    credentials: true, // Allow cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);


// ─── General Middlewares ──────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" })); // Reject request body larger than 10kb
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser(env.COOKIE_SECRET));

// Prevent NoSQL injection attacks — strips MongoDB operator keys from request bodies
app.use((req, _res, next) => {
  const sanitize = (obj: unknown): unknown => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const clean: Record<string, unknown> = {};
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (!key.startsWith("$")) {
          clean[key] = sanitize((obj as Record<string, unknown>)[key]);
        }
      }
      return clean;
    }
    if (Array.isArray(obj)) return obj.map(sanitize);
    return obj;
  };
  if (req.body) req.body = sanitize(req.body);
  next();
});


// HTTP request logging
app.use(
  morgan("dev", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
 
app.use("/api", apiLimiter);
app.use("/api/v1", apiLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/api", router);
app.use("/api/v1", router);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
