import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../state/auth";

const ALL_STAGES = ["dev", "staging", "prod", "personal"];

function StagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="checks">
      {ALL_STAGES.map((s) => (
        <label key={s}>
          <input
            type="checkbox"
            checked={value.includes(s)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))
            }
          />
          {s}
        </label>
      ))}
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { project = "" } = useParams();
  const { session } = useAuth();
  const [detail, setDetail] = useState<api.ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStages, setInviteStages] = useState<string[]>(["dev"]);
  const [busy, setBusy] = useState(false);

  const isOwner = detail?.owner === session?.email;

  const load = useCallback(async () => {
    try {
      setDetail(await api.projectDetail(project));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function invite(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api.addProjectMember(project, inviteEmail.trim(), inviteStages);
      setInviteEmail("");
    });
  }

  return (
    <div className="fade-in">
      <p className="kicker">
        <Link to={`/projects/${project}`} style={{ color: "inherit", textDecoration: "none" }}>
          ← {project}
        </Link>
      </p>
      <h1>Members</h1>
      <p className="sub">
        Inviting an email is what lets that address log in — access is invite-only. Members
        see only the stages you grant.
      </p>

      {error && <p className="error">{error}</p>}
      {detail === null ? (
        <p className="loading">loading</p>
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Members</h2>
            </div>
            <ul className="list">
              {detail.members.map((m) => (
                <li key={m.email}>
                  <div className="grow mono" style={{ fontSize: 14 }}>
                    {m.email}
                  </div>
                  {m.stages.map((s) => (
                    <span key={s} className="tag">
                      {s}
                    </span>
                  ))}
                  <span className={`tag ${m.role === "owner" ? "accent" : ""}`}>{m.role}</span>
                  {isOwner && m.role !== "owner" && (
                    <button
                      className="btn quiet danger"
                      disabled={busy}
                      onClick={() => void run(() => api.removeProjectMember(project, m.email))}
                    >
                      remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <div className="panel-body" style={{ borderTop: "1px solid var(--line)" }}>
                <form onSubmit={invite}>
                  <div className="row">
                    <label className="field">
                      <span>invite email</span>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@example.com"
                      />
                    </label>
                    <button className="btn" disabled={busy || !inviteEmail.trim() || inviteStages.length === 0}>
                      invite
                    </button>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <StagePicker value={inviteStages} onChange={setInviteStages} />
                  </div>
                </form>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
