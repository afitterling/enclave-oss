import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../state/auth";

export default function ProjectsPage() {
  const { refreshAccess } = useAuth();
  const [projects, setProjects] = useState<api.ProjectSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects((await api.listProjects()).projects);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createProject(name.trim());
      setName("");
      await Promise.all([load(), refreshAccess()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <p className="kicker">vault</p>
      <h1>Projects</h1>
      <p className="sub">
        A project is a namespace of encrypted files, split across stages. You only see
        projects you own or were invited to.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        <div className="panel-head">
          <h2>New project</h2>
        </div>
        <div className="panel-body">
          <form onSubmit={create} className="row">
            <label className="field">
              <span>project name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-app"
                pattern="[\w.@+-]+"
                title="letters, digits, . _ @ + - only"
              />
            </label>
            <button className="btn primary" disabled={busy || !name.trim()}>
              {busy ? "creating…" : "create"}
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Your projects</h2>
        </div>
        {projects === null ? (
          <p className="loading">loading</p>
        ) : projects.length === 0 ? (
          <p className="empty">No projects yet — create one above.</p>
        ) : (
          <ul className="list">
            {projects.map((p) => (
              <li key={p.project}>
                <div className="grow">
                  <Link className="plain" to={`/projects/${p.project}`}>
                    {p.project}
                  </Link>
                </div>
                {p.stages.map((s) => (
                  <span key={s} className="tag">
                    {s}
                  </span>
                ))}
                <span className={`tag ${p.role === "owner" ? "accent" : ""}`}>{p.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
