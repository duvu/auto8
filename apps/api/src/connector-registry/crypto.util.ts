import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const PREFIX = "enc:";

/**
 * Encrypt text using AES-256-GCM.
 * @param text Plaintext to encrypt
 * @param keyHex 32-byte key as hex string (64 hex chars)
 * @returns Ciphertext in format: `enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encrypt(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes (64 hex chars)");

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt ciphertext encrypted by `encrypt()`.
 * @param ciphertext Ciphertext in format `enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * @param keyHex 32-byte key as hex string (64 hex chars)
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string, keyHex: string): string {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error("Invalid ciphertext format: missing enc: prefix");
  }

  const parts = ciphertext.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format: expected enc:<iv>:<tag>:<data>");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const encrypted = Buffer.from(encryptedHex!, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Returns true if the given string is in encrypted format.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
