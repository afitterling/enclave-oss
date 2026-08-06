import { useEffect, useState } from "react";
import { downloadAndDecrypt } from "../lib/crypto";
import { parseEnv } from "../lib/envfile";
import type { EnvEntry } from "../lib/envfile";
import EnvTable from "./EnvTable";

interface Props {
  project: string;
  stage: string;
  file: string;
  onClose: () => void;
}

/** Decrypts a file in-browser and shows it as a masked env table when it
 * parses as dotenv, otherwise as raw text. */
export default function FileViewer({ project, stage, file, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [entries, setEntries] = useState<EnvEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setEntries(null);
    setError(null);
    downloadAndDecrypt(project, stage, file)
      .then((bytes) => {
        if (cancelled) return;
        const decoded = new TextDecoder().decode(bytes);
        setText(decoded);
        setEntries(parseEnv(decoded));
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [project, stage, file]);

  function downloadPlaintext() {
    if (text === null) return;
    const blob = new Blob([text], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="panel fade-in">
      <div className="panel-head">
        <h2>
          <span className="mono">{file}</span>
        </h2>
        <span className="tag">{stage}</span>
        {entries !== null && <span className="tag accent">env</span>}
        <div className="spacer" />
        <button className="btn quiet" onClick={downloadPlaintext} disabled={text === null}>
          download
        </button>
        <button className="btn quiet" onClick={onClose}>
          close
        </button>
      </div>
      <div className="panel-body">
        {error ? (
          <p className="error">{error}</p>
        ) : text === null ? (
          <p className="loading">decrypting</p>
        ) : entries !== null ? (
          <EnvTable entries={entries} />
        ) : (
          <pre className="raw">{text}</pre>
        )}
      </div>
    </div>
  );
}
