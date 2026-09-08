import app from "./src/app";
import { connectDB } from "./src/config/db";
import { connectRedis, isRedisConnected } from "./src/config/redis";
import { env } from "./src/config/env";
import { logger } from "./src/utils/logger";

const startServer = async (): Promise<void> => {
  try {
    // Database connections pehle
    await connectDB();
    await connectRedis();

    const server = app.listen(env.PORT, () => {
      // ─── Startup Status ───────────────────────────────
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  🚀  Server  : http://localhost:" + env.PORT);
      console.log("  🍃  MongoDB : ✅ Connected");

      if (isRedisConnected()) {
        console.log("  ⚡  Redis   : ✅ Connected — Cache Active");
      } else {
        console.log("  ⚡  Redis   : ❌ Not Running");
        console.log("  💡  Tip     : Run redis-server before testing data");
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    // Graceful shutdown — Ctrl+C ya SIGTERM pe
    const shutdown = async (signal: string) => {
      logger.warn(`${signal} received — shutting down gracefully...`);
      server.close(async () => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Unhandled promise rejections
    process.on("unhandledRejection", (err: Error) => {
      logger.error("UNHANDLED REJECTION:", err.message);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
