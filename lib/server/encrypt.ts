// AES-256-GCM helpers for encrypting cookies / secrets at rest.
//
// Format: `iv_hex:tag_hex:ciphertext_hex` (auth tag stored separately so the
// format stays compatible with Node's createCipheriv interface if we ever swap
// the implementation back).
//
// Key source: `process.env.COOKIE_ENCRYPTION_KEY` — must be a 32-byte (64-char)
// hex string. Generate with `openssl rand -hex 32`.
//
// Why GCM: provides authenticated encryption (built-in tampering detection),
// fast on Node + V8, and the standard recommendation for short-lived secrets.
//
// Why Web Crypto and not Node's `crypto`: Convex queries and mutations run in
// a V8 isolate that exposes the Web Crypto API but not the Node `crypto`
// module. Web Crypto works in both Convex V8 isolates and Node so this helper
// can be imported from either environment (`convex/linkedinCookies.ts` and
// the LinkedIn adapter under `lib/intake/linkedin/`).
//
// Used by `convex/linkedinCookies.ts` to wrap LinkedIn `li_at` cookies so a
// database snapshot leak does not directly expose session credentials.

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12; // 96-bit IV is the recommended size for GCM
const KEY_BYTES = 32; // AES-256 → 32-byte key
const TAG_BYTES = 16; // 128-bit auth tag (Web Crypto appends to ciphertext)

let cachedKey: Promise<CryptoKey> | null = null;

function getSubtle(): SubtleCrypto {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webCrypto || !webCrypto.subtle) {
    throw new Error(
      "Web Crypto API (crypto.subtle) is not available in this environment."
    );
  }
  return webCrypto.subtle;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string must have an even length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex character");
    out[i] = byte;
  }
  return out;
}

function decodeKey(raw: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === KEY_BYTES * 2) {
    return hexToBytes(raw);
  }
  // Fall back to base64 — let the runtime do the decode.
  try {
    const binary =
      typeof atob === "function"
        ? atob(raw)
        : Buffer.from(raw, "base64").toString("binary");
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new Error(
      "COOKIE_ENCRYPTION_KEY must be 32 bytes encoded as hex or base64."
    );
  }
}

function loadKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = (process.env.COOKIE_ENCRYPTION_KEY ?? "").trim();
  if (!raw) {
    return Promise.reject(
      new Error(
        "COOKIE_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` " +
          "and add it to your environment (Convex deployment + `.env.local`)."
      )
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeKey(raw);
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }
  if (bytes.length !== KEY_BYTES) {
    return Promise.reject(
      new Error(
        `COOKIE_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${bytes.length}.`
      )
    );
  }
  cachedKey = getSubtle().importKey(
    "raw",
    toBufferSource(bytes),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
  return cachedKey;
}

// Coerce a Uint8Array into a fresh ArrayBuffer-backed BufferSource. Needed
// because TS sees `Uint8Array<ArrayBufferLike>` (which could be a
// SharedArrayBuffer view) as incompatible with WebCrypto's `BufferSource`.
function toBufferSource(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

/**
 * Encrypt `plaintext` with AES-256-GCM.
 *
 * Returns `iv_hex:tag_hex:ciphertext_hex`. Each `encrypt()` call generates a
 * fresh random IV, so encrypting the same plaintext twice yields distinct
 * ciphertexts.
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (typeof plaintext !== "string") {
    throw new TypeError("encrypt() expects a string plaintext");
  }
  const key = await loadKey();
  const iv = new Uint8Array(IV_BYTES);
  (globalThis.crypto as Crypto).getRandomValues(iv);
  const data = new TextEncoder().encode(plaintext);
  const sealed = new Uint8Array(
    await getSubtle().encrypt(
      { name: ALGORITHM, iv: toBufferSource(iv) },
      key,
      toBufferSource(data)
    )
  );
  // Web Crypto appends the 16-byte tag to the ciphertext. Split it back out so
  // the on-disk format matches the documented `iv:tag:ct` shape.
  if (sealed.length < TAG_BYTES) {
    throw new Error("encrypt(): unexpected ciphertext length");
  }
  const ct = sealed.slice(0, sealed.length - TAG_BYTES);
  const tag = sealed.slice(sealed.length - TAG_BYTES);
  return `${bytesToHex(iv)}:${bytesToHex(tag)}:${bytesToHex(ct)}`;
}

/**
 * Decrypt a value produced by `encrypt()`. Throws if the ciphertext is
 * malformed, the auth tag does not verify, or the key is missing.
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (typeof ciphertext !== "string" || !ciphertext) {
    throw new TypeError("decrypt() expects a non-empty string");
  }
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("decrypt(): malformed ciphertext (expected iv:tag:ct)");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = hexToBytes(ivHex);
  const tag = hexToBytes(tagHex);
  const ct = hexToBytes(ctHex);
  if (iv.length !== IV_BYTES) {
    throw new Error(`decrypt(): IV must be ${IV_BYTES} bytes`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`decrypt(): tag must be ${TAG_BYTES} bytes`);
  }
  // Web Crypto wants the tag concatenated to the ciphertext.
  const sealed = new Uint8Array(ct.length + tag.length);
  sealed.set(ct, 0);
  sealed.set(tag, ct.length);
  const key = await loadKey();
  const plain = await getSubtle().decrypt(
    { name: ALGORITHM, iv: toBufferSource(iv) },
    key,
    toBufferSource(sealed)
  );
  return new TextDecoder().decode(plain);
}

/**
 * Detect whether a value already looks like a `iv:tag:ct` ciphertext. Used by
 * the cookie store so we can opportunistically migrate plaintext rows on read.
 */
export function looksEncrypted(value: string): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[0-9a-fA-F]+$/.test(p) && p.length > 0);
}
