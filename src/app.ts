// Must load before any model: watches old → new values for the Activity Log
import "./config/activityTracker";
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
import { activityLogger } from "./middlewares/activityLog.middleware";
import { apiBlockGuard } from "./modules/apiLimits/apiLimits.service";
import router from "./routes/index";
import { generateSitemapXml } from "./modules/seo/sitemap.controller";

const app = express();

// Behind Nginx in production — use the visitor's IP (X-Forwarded-For) for rate limiting
app.set("trust proxy", 1);

// ─── Security Middlewares ─────────────────────────────────────────────────────

// The chatbot spends OpenAI credits, so only the website's own origins may call it from a
// browser. Every other route keeps the open CORS policy below.
const chatOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
app.use(["/api/chat", "/api/v1/chat"], (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && chatOrigins.length > 0 && !chatOrigins.includes(origin)) {
    res.status(403).json({ success: false, message: "Origin not allowed" });
    return;
  }
  next();
});

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
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "public", "uploads"))
);
app.use("/exhibitors", express.static(path.join(process.cwd(), "public", "exhibitors")));
app.use(
  "/seo-files",
  (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "public", "seo-files"))
);

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

// ─── Sitemap (public, no auth, no rate limit) ────────────────────────────────

app.get("/sitemap.xml", generateSitemapXml);

// ─── Activity Log (admin create / update / delete / login) ───────────────────

app.use("/api", activityLogger);

// ─── IP Block Limits (3 attempts → IP blocked on that website API) ──────────

app.use("/api", apiBlockGuard);

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
