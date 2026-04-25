import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

export function encryptOAuthToken(token: string, secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY) {
  if (!secret) throw new Error("missing_oauth_token_encryption_key");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, b64(iv), b64(tag), b64(encrypted)].join(".");
}

export function decryptOAuthToken(payload: string, secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY) {
  if (!secret) throw new Error("missing_oauth_token_encryption_key");
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error("invalid_encrypted_oauth_token");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function b64(value: Buffer) {
  return value.toString("base64url");
}
