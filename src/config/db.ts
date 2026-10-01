import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

// Some Windows setups leave Node's resolver pointing at 127.0.0.1, which breaks
// the SRV lookup for mongodb+srv:// URIs (querySrv ECONNREFUSED). Fall back to public DNS.
const servers = dns.getServers();
if (servers.length === 1 && servers[0] === "127.0.0.1") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (isConnected) {
    logger.info("MongoDB already connected");
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,        // Connection pool — maximum 10 concurrent connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Graceful database disconnection
export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info("MongoDB disconnected");
};
