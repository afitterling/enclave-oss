/** Byte-for-byte compatibility with cli/enclave/crypto.py, proven via the
 * shared fixture in testdata/envelope-vector.json (also asserted by
 * cli/tests/test_crypto.py). Runs on Node's WebCrypto — no KMS needed. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fromB64, toB64 } from "./b64";
import { decodeEnvelope, openEnvelope, seal } from "./envelope";

const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../testdata/envelope-vector.json", import.meta.url)), "utf8"),
) as {
  key_hex: string;
  nonce_hex: string;
  wrapped_b64: string;
  plaintext_utf8: string;
  envelope_b64: string;
};

const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));

const KEY = fromHex(vector.key_hex);
const NONCE = fromHex(vector.nonce_hex);
const WRAPPED = fromB64(vector.wrapped_b64);
const PLAINTEXT = new TextEncoder().encode(vector.plaintext_utf8);
const ENVELOPE = fromB64(vector.envelope_b64);

describe("ENV1 envelope (Python compatibility)", () => {
  it("seal with the fixture nonce reproduces the Python envelope exactly", async () => {
    const env = await seal(KEY, WRAPPED, PLAINTEXT, NONCE);
    expect(toB64(env)).toBe(vector.envelope_b64);
  });

  it("decodes the Python envelope into its parts", () => {
    const { wrapped, nonce, ciphertext } = decodeEnvelope(ENVELOPE);
    expect(toB64(wrapped)).toBe(vector.wrapped_b64);
    expect(nonce).toEqual(NONCE);
    expect(ciphertext.length).toBe(PLAINTEXT.length + 16); // GCM tag
  });

  it("decrypts the Python envelope", async () => {
    const pt = await openEnvelope(KEY, ENVELOPE);
    expect(new TextDecoder().decode(pt)).toBe(vector.plaintext_utf8);
  });

  it("round-trips random content", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = crypto.getRandomValues(new Uint8Array(184));
    const content = crypto.getRandomValues(new Uint8Array(4096));
    const env = await seal(key, wrapped, content);
    expect(await openEnvelope(key, env)).toEqual(content);
  });

  it("rejects a bad magic", () => {
    const bad = ENVELOPE.slice();
    bad[0] = 0x58;
    expect(() => decodeEnvelope(bad)).toThrow(/not an enclave-envoy envelope/);
  });
});
