import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";

export default function TeamsPage() {
  const [teams, setTeams] = useState<api.TeamSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeams((await api.listTeams()).teams);
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
      await api.createTeam(name.trim());
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <p className="kicker">access groups</p>
      <h1>Teams</h1>
      <p className="sub">
        A team is a named group of people. Project owners can grant a whole team access to
        chosen stages in one step.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        <div className="panel-head">
          <h2>New team</h2>
        </div>
        <div className="panel-body">
          <form onSubmit={create} className="row">
            <label className="field">
              <span>team name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="platform"
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
          <h2>Your teams</h2>
        </div>
        {teams === null ? (
          <p className="loading">loading</p>
        ) : teams.length === 0 ? (
          <p className="empty">No teams yet.</p>
        ) : (
          <ul className="list">
            {teams.map((t) => (
              <li key={t.team}>
                <div className="grow">
                  <Link className="plain" to={`/teams/${t.team}`}>
                    {t.team}
                  </Link>
                </div>
                <span className={`tag ${t.role === "owner" ? "accent" : ""}`}>{t.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
