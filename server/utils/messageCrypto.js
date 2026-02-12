import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-gcm";
// 32 bytes hex key (64 hex chars). Falls back to a dev-only key. MUST be set in production.
const KEY_HEX =
  process.env.MESSAGE_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY = Buffer.from(KEY_HEX, "hex");

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext
 * @returns {{ ciphertext: string, iv: string, tag: string }}
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

/**
 * Decrypt a ciphertext encrypted with encrypt().
 * @param {string} ciphertext  hex-encoded
 * @param {string} ivHex       hex-encoded 12-byte IV
 * @param {string} tagHex      hex-encoded auth tag
 * @returns {string}           plaintext
 */
export function decrypt(ciphertext, ivHex, tagHex) {
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
