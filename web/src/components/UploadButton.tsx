import { useRef, useState } from "react";
import { encryptAndUpload } from "../lib/crypto";

const SAFE_NAME = /^[\w.@+-]+$/;

interface Props {
  project: string;
  stage: string;
  onUploaded: (file: string) => void;
  onError: (msg: string) => void;
}

/** Picks a local file, encrypts it in-browser, uploads via presigned PUT. */
export default function UploadButton({ project, stage, onUploaded, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(f: File) {
    // Match the server-side key rule: flat basenames only.
    const name = f.name.trim();
    if (!SAFE_NAME.test(name)) {
      onError(`"${name}" — file names may only use letters, digits and . _ @ + -`);
      return;
    }
    setBusy(true);
    try {
      const content = new Uint8Array(await f.arrayBuffer());
      await encryptAndUpload(project, stage, name, content);
      onUploaded(name);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button className="btn primary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "encrypting…" : "upload file"}
      </button>
    </>
  );
}
