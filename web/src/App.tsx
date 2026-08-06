import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { flags } from "./lib/flags";
import { useAuth } from "./state/auth";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectPage from "./pages/ProjectPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";

export default function App() {
  const { session, logout } = useAuth();

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={flags.landing ? <LandingPage /> : <LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          enclave<b>-envoy</b>
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Projects
          </NavLink>
        </nav>
        <div className="who">
          <span>{session.email}</span>
          <button className="btn quiet" onClick={logout}>
            log out
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:project" element={<ProjectPage />} />
        <Route path="/projects/:project/settings" element={<ProjectSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
