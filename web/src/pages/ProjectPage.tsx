import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { deleteFile } from "../lib/crypto";
import { flags } from "../lib/flags";
import { useAuth } from "../state/auth";
import FileList from "../components/FileList";
import FileViewer from "../components/FileViewer";
import UploadButton from "../components/UploadButton";

export default function ProjectPage() {
  const { project = "" } = useParams();
  const { session, refreshAccess } = useAuth();
  const stages = session?.access[project] ?? [];
  const [stage, setStage] = useState<string | null>(stages[0] ?? null);
  const [files, setFiles] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Access map may be stale (e.g. project created in another tab / invited since login).
  useEffect(() => {
    if (stages.length === 0) void refreshAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (stage === null && stages.length > 0) setStage(stages[0]);
  }, [stages, stage]);

  const load = useCallback(async () => {
    if (!stage) return;
    setFiles(null);
    try {
      setFiles((await api.listFiles(project, stage)).files);
    } catch (err) {
      setError((err as Error).message);
      setFiles([]);
    }
  }, [project, stage]);

  useEffect(() => {
    setViewing(null);
    setError(null);
    void load();
  }, [load]);

  async function remove(file: string) {
    if (!stage) return;
    if (!window.confirm(`Delete ${file} from ${project}/${stage}? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteFile(project, stage, file);
      if (viewing === file) setViewing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fade-in">
      <p className="kicker">project</p>
      <h1 className="mono">{project}</h1>
      <p className="sub">
        Files are encrypted in your browser before upload and decrypted only when you view
        them. <Link to={`/projects/${project}/settings`}>Members &amp; teams →</Link>
      </p>

      {stages.length === 0 ? (
        <p className="empty">You have no stage access in this project.</p>
      ) : (
        <>
          <div className="stages">
            {stages.map((s) => (
              <button key={s} className={s === stage ? "active" : ""} onClick={() => setStage(s)}>
                {s}
              </button>
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="panel">
            <div className="panel-head">
              <h2>
                Files <span className="mono">/ {stage}</span>
              </h2>
              <div className="spacer" />
              {stage && (
                <UploadButton
                  project={project}
                  stage={stage}
                  onUploaded={() => void load()}
                  onError={setError}
                />
              )}
            </div>
            <FileList
              files={files}
              selected={viewing}
              onView={setViewing}
              onDelete={flags.fileDelete ? (f) => void remove(f) : undefined}
            />
          </div>

          {viewing && stage && (
            <FileViewer project={project} stage={stage} file={viewing} onClose={() => setViewing(null)} />
          )}
        </>
      )}
    </div>
  );
}
