/**
 * ENV1 envelope codec — byte-for-byte compatible with cli/enclave/crypto.py:
 *
 *   magic     "ENV1"        4 bytes
 *   blob_len  uint16 BE     2 bytes   length of the KMS-wrapped data key
 *   blob      blob_len      KMS CiphertextBlob (opaque)
 *   nonce     12 bytes      AES-GCM nonce
 *   ciphertext+tag          remainder (WebCrypto emits ct || 16-byte tag,
 *                           identical to Python's AESGCM)
 *
 * No AAD is used on either side.
 */

const MAGIC = new Uint8Array([0x45, 0x4e, 0x56, 0x31]); // "ENV1"
const NONCE_LEN = 12;
const HEADER_LEN = 6;

export interface Envelope {
  wrapped: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export function encodeEnvelope(wrapped: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (nonce.length !== NONCE_LEN) throw new Error("nonce must be 12 bytes");
  if (wrapped.length > 0xffff) throw new Error("wrapped key too large");
  const out = new Uint8Array(HEADER_LEN + wrapped.length + NONCE_LEN + ciphertext.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint16(4, wrapped.length, false); // big-endian
  out.set(wrapped, HEADER_LEN);
  out.set(nonce, HEADER_LEN + wrapped.length);
  out.set(ciphertext, HEADER_LEN + wrapped.length + NONCE_LEN);
  return out;
}

export function decodeEnvelope(env: Uint8Array): Envelope {
  if (env.length < HEADER_LEN + NONCE_LEN || !MAGIC.every((b, i) => env[i] === b)) {
    throw new Error("not an enclave-envoy envelope");
  }
  const blobLen = new DataView(env.buffer, env.byteOffset).getUint16(4, false);
  const wrapped = env.slice(HEADER_LEN, HEADER_LEN + blobLen);
  const nonce = env.slice(HEADER_LEN + blobLen, HEADER_LEN + blobLen + NONCE_LEN);
  const ciphertext = env.slice(HEADER_LEN + blobLen + NONCE_LEN);
  return { wrapped, nonce, ciphertext };
}

async function importKey(raw: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("expected a 256-bit data key");
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [usage]);
}

/** Encrypt content into a full envelope. `nonce` is injectable for tests only. */
export async function seal(
  plaintextKey: Uint8Array,
  wrapped: Uint8Array,
  content: Uint8Array,
  nonce?: Uint8Array,
): Promise<Uint8Array> {
  const iv = nonce ?? crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await importKey(plaintextKey, "encrypt");
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, content as BufferSource),
  );
  return encodeEnvelope(wrapped, iv, ct);
}

/** Decrypt a full envelope given the unwrapped plaintext data key. */
export async function openEnvelope(plaintextKey: Uint8Array, env: Uint8Array): Promise<Uint8Array> {
  const { nonce, ciphertext } = decodeEnvelope(env);
  const key = await importKey(plaintextKey, "decrypt");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(pt);
}
