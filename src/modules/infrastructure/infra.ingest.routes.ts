import { createHash } from "node:crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { activityContext } from "../../config/activityTracker";
import { ingest } from "./infra.monitoring";
import { E, infraErrorHandler } from "./infra.util";

/**
 * Collector push endpoint. It is deliberately outside the admin session system: the bearer token (stored only as a
 * SHA-256 hash) identifies exactly one server, and the server comes from that token, never from the payload.
 *
 * Mounted in app.ts BEFORE the global 50 MB JSON parser so this route can enforce its own 256 KB body cap, and before
 * the Activity Log / IP-block middleware (a machine push is not an admin action).
 */
const MAX_BODY = "256kb";

const perCollector = rateLimit({
  windowMs: 60_000,
  // a healthy collector pushes once every 30-60 s; the service additionally enforces the 15 s minimum
  limit: () => (Number(process.env.INFRA_INGEST_RATE_PER_MIN) > 0 ? Number(process.env.INFRA_INGEST_RATE_PER_MIN) : 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? "")?.[1];
    return token ? `c:${createHash("sha256").update(token).digest("hex")}` : `ip:${req.ip}`;
  },
  handler: (_req, res) => {
    res.status(429).json({ success: false, statusCode: 429, message: "Too many pushes from this collector.", code: "infra_rate_limited" });
  },
});

const router = Router();

router.post(
  "/",
  perCollector,
  express.json({ limit: MAX_BODY }),
  (req, res, next) => {
    // Machine writes must not be snapshotted by the admin Activity-Log plugin (it would add reads to every sample).
    activityContext.exit(() => {
      ingest(req.headers.authorization, req.body)
        .then((data) => res.status(202).json({ success: true, statusCode: 202, message: "Accepted", data, timestamp: new Date().toISOString() }))
        .catch(next);
    });
  }
);

// A body over the cap, or malformed JSON, is a client error - not a 500.
router.use((err: any, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") return next(E.badRequest("Payload is too large.", "infra_payload_too_large"));
  if (err?.type === "entity.parse.failed") return next(E.badRequest("Body is not valid JSON.", "infra_invalid_sample"));
  next(err);
});
router.use(infraErrorHandler);

export const infraIngestRouter = router;
