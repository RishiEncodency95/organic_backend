import express from "express";
import path from "path";
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
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration — allow frontend & admin origins
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
    exposedHeaders: ["*"],
  })
);

// Explicit Preflight Handler
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.status(200).end();
    return;
  }
  next();
});


// ─── General Middlewares ──────────────────────────────────────────────────────

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/exhibitors", express.static(path.join(process.cwd(), "public", "exhibitors")));

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
