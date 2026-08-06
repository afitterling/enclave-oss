import { datakeyDecrypt, datakeyGenerate, presign } from "./api";
import { fromB64, toB64 } from "./b64";
import { decodeEnvelope, openEnvelope, seal } from "./envelope";

/** Encrypt `content` for (project, stage) and upload it as `file`.
 * Plaintext and the data key only ever exist in this browser's memory. */
export async function encryptAndUpload(
  project: string,
  stage: string,
  file: string,
  content: Uint8Array,
): Promise<void> {
  const dk = await datakeyGenerate(project, stage);
  const envelope = await seal(fromB64(dk.plaintext), fromB64(dk.ciphertext), content);
  const target = await presign("upload", project, stage, file);
  // Send raw bytes without a Content-Type: the presigned signature didn't
  // cover one, and a typed Blob would make fetch attach it.
  const res = await fetch(target.url, { method: "PUT", body: envelope as unknown as BodyInit });
  if (!res.ok) throw new Error(`upload failed: HTTP ${res.status}`);
}

/** Download `file`, unwrap its data key via KMS, and decrypt in-browser. */
export async function downloadAndDecrypt(project: string, stage: string, file: string): Promise<Uint8Array> {
  const source = await presign("download", project, stage, file);
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const envelope = new Uint8Array(await res.arrayBuffer());
  const { wrapped } = decodeEnvelope(envelope);
  const dk = await datakeyDecrypt(project, stage, toB64(wrapped));
  return openEnvelope(fromB64(dk.plaintext), envelope);
}

/** Delete `file` via a presigned DELETE. */
export async function deleteFile(project: string, stage: string, file: string): Promise<void> {
  const target = await presign("delete", project, stage, file);
  const res = await fetch(target.url, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`delete failed: HTTP ${res.status}`);
}
