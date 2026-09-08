import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

let redisConnected = false;

// Redis client — singleton instance
const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,   // Attempt connection only once to prevent persistent error spam
  retryStrategy() {
    return null;             // Disable automatic retry on failure
  },
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on("connect", () => {
  redisConnected = true;
});

redisClient.on("error", () => {
  // Silently handled during initial startup
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    redisConnected = true;
  } catch {
    redisConnected = false;
    // Handled in server.ts initialization log
  }
};

export const isRedisConnected = (): boolean => redisConnected;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Save data to Redis cache
 * @param key - Cache key
 * @param data - Payload data to store
 * @param ttlSeconds - Expiration time in seconds (default: 5 minutes)
 */
export const setCache = async <T>(
  key: string,
  data: T,
  ttlSeconds: number = 300
): Promise<void> => {
  if (!redisConnected) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    logger.error(`Cache set error [${key}]:`, error);
  }
};

/**
 * Retrieve data from Redis cache
 * @param key - Cache key
 * @returns Parsed data or null if cache miss
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!redisConnected) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error(`Cache get error [${key}]:`, error);
    return null;
  }
};

/**
 * Delete cached key or matching pattern
 * @param key - Specific key or pattern (e.g., "dashboard:*")
 */
export const deleteCache = async (key: string): Promise<void> => {
  if (!redisConnected) return;
  try {
    if (key.includes("*")) {
      const keys = await redisClient.keys(key);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      await redisClient.del(key);
    }
  } catch (error) {
    logger.error(`Cache delete error [${key}]:`, error);
  }
};

/**
 * Check if a key exists in cache
 */
export const cacheExists = async (key: string): Promise<boolean> => {
  if (!redisConnected) return false;
  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch {
    return false;
  }
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  DASHBOARD: 5 * 60,     // 5 minutes
  USER_LIST: 2 * 60,     // 2 minutes
  SETTINGS: 30 * 60,     // 30 minutes
  SESSION: 15 * 60,      // 15 minutes (Access token lifespan)
} as const;

// Standardized cache key patterns
export const CACHE_KEYS = {
  DASHBOARD_STATS: "dashboard:stats",
  ADMIN_LIST: "admin:list",
  SETTINGS: "settings:global",
  USER: (id: string) => `user:${id}`,
} as const;

export default redisClient;
