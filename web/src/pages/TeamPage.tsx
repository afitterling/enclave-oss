import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../state/auth";

export default function TeamPage() {
  const { team = "" } = useParams();
  const { session } = useAuth();
  const [detail, setDetail] = useState<api.TeamDetail | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = detail?.owner === session?.email;

  const load = useCallback(async () => {
    try {
      setDetail(await api.teamDetail(team));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [team]);

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

  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api.addTeamMember(team, email.trim());
      setEmail("");
    });
  }

  return (
    <div className="fade-in">
      <p className="kicker">
        <Link to="/teams" style={{ color: "inherit", textDecoration: "none" }}>
          ← teams
        </Link>
      </p>
      <h1 className="mono">{team}</h1>
      <p className="sub">
        Team members inherit every project grant below. Adding an email also lets that
        address log in.
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
                  <span className={`tag ${m.role === "owner" ? "accent" : ""}`}>{m.role}</span>
                  {isOwner && m.role !== "owner" && (
                    <button
                      className="btn quiet danger"
                      disabled={busy}
                      onClick={() => void run(() => api.removeTeamMember(team, m.email))}
                    >
                      remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <div className="panel-body" style={{ borderTop: "1px solid var(--line)" }}>
                <form onSubmit={add} className="row">
                  <label className="field">
                    <span>add member</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teammate@example.com"
                    />
                  </label>
                  <button className="btn" disabled={busy || !email.trim()}>
                    add
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Project grants</h2>
            </div>
            {detail.grants.length === 0 ? (
              <p className="empty">
                No grants yet — a project owner can grant this team access from the project's
                settings page.
              </p>
            ) : (
              <ul className="list">
                {detail.grants.map((g) => (
                  <li key={g.project}>
                    <div className="grow">
                      <Link className="plain" to={`/projects/${g.project}`}>
                        {g.project}
                      </Link>
                    </div>
                    {g.stages.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
