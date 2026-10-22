import { decryptField, encryptField, parseMasterKey } from "./core/encryption.util";
import { E } from "./infra.util";

/**
 * Provider credentials are encrypted at rest with AES-256-GCM using this deployment's own ENCRYPTION_MASTER_KEY
 * (base64, 32 bytes). Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Never reuse another system's key. Without a key, anything that needs to store a credential refuses with 503.
 */
let cached: { raw: string; key: Buffer } | null = null;

function key(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!raw) throw E.unavailable("Credential storage is not configured on the server (ENCRYPTION_MASTER_KEY is missing).", "infra_encryption_not_configured");
  if (cached?.raw === raw) return cached.key;
  try {
    cached = { raw, key: parseMasterKey(raw) };
  } catch {
    throw E.unavailable("ENCRYPTION_MASTER_KEY is invalid: it must be a base64-encoded 32-byte key.", "infra_encryption_not_configured");
  }
  return cached.key;
}

export const encryptionConfigured = (): boolean => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

export const encryptSecret = (plaintext: string): string => encryptField(plaintext, key());
export const decryptSecret = (stored: string): string => decryptField(stored, key());
