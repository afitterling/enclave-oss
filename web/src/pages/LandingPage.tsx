import { Link } from "react-router-dom";
import { edition } from "../lib/flags";

const CLI_QUICKSTART = `# install the CLI
pip install -e cli/

# point it at your deployment and sign in (email OTP)
enclave configure --api-url https://<your-api>.execute-api.<region>.amazonaws.com
enclave login you@example.com

# push an env file — encrypted locally before upload
enclave push --project my-app --stage dev .env

# pull it on another device
enclave pull --project my-app --stage dev --dest ~/`;

const WEB_QUICKSTART = `1  Sign in with your email — a one-time code arrives by mail.
2  Create a project. You become its owner, with all four stages.
3  Upload a .env — it is AES-256-GCM encrypted in this tab first.
4  View it: values render masked, reveal or copy per row.
5  Invite teammates per stage, or grant a whole team at once.`;

const DEPLOY_QUICKSTART = `# one stack: API, KMS key, DynamoDB, S3, this site
cd infra && npm install
npx sst secret set JwtSigningKey "$(openssl rand -hex 32)" --stage dev
npx sst secret set SesSender no-reply@yourdomain --stage dev
npx sst deploy --stage dev   # prints ApiUrl + SiteUrl`;

function Placeholder({ label, ratio = "16 / 9" }: { label: string; ratio?: string }) {
  return (
    <figure className="ph-frame" style={{ aspectRatio: ratio }}>
      <figcaption>
        <span className="ph-tag">image placeholder</span>
        {label}
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="land-top">
        <span className="brand">
          enclave<b>-envoy</b>
        </span>
        <div className="spacer" />
        <a
          className="btn quiet"
          href="https://github.com/afitterling/enclave-secure-env-key-value-store-aws-kms"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
        <Link className="btn" to="/login">
          sign in
        </Link>
      </header>

      {/* ---- hero ---------------------------------------------------- */}
      <section className="hero">
        <p className="kicker">end-to-end encrypted env &amp; dotfile vault</p>
        <h1>
          Your secrets never
          <br />
          leave your machine
          <span className="cursor">_</span>
        </h1>
        <p className="sub" style={{ maxWidth: "52ch" }}>
          enclave-envoy syncs <code>.env</code> files and dotfiles across devices and
          teammates. Files are encrypted <em>in your browser or CLI</em> with AES-256-GCM
          under an AWS&nbsp;KMS-wrapped data key — S3 and every server in between only ever
          see ciphertext.
        </p>
        <div className="hero-cta">
          <Link className="btn primary" to="/login">
            sign in with email
          </Link>
          <a className="btn" href="#quickstart">
            quickstart
          </a>
        </div>
        <pre className="diagram" aria-label="architecture diagram">
{`device A ──encrypt──►  S3  (project/stage/file)  ◄──decrypt── device B
   │                     ▲                                │
   └──── KMS data key ───┘─────────── KMS data key ───────┘
             (master key never leaves KMS)`}
        </pre>
      </section>

      {/* ---- product shots ------------------------------------------- */}
      <section className="land-section">
        <h2>What it looks like</h2>
        <div className="ph-grid">
          <Placeholder label="masked KEY=VALUE viewer with per-row reveal & copy" />
          <Placeholder label="projects & stages — dev / staging / prod / personal" />
          <Placeholder label="team grants — one grant, whole team access" />
        </div>
      </section>

      {/* ---- core languages ------------------------------------------ */}
      <section className="land-section" id="languages">
        <h2>Core languages</h2>
        <p className="sub">
          Two first-class clients, one byte-compatible envelope format — push from the CLI,
          read in the browser, or the other way round. The HTTP API underneath is plain
          JSON, callable from any language.
        </p>
        <div className="lang-grid">
          <div className="lang-card">
            <span className="tag accent">python</span>
            <h3>CLI</h3>
            <p>
              <code>enclave push / pull</code> for whole-directory dotfile sync.{" "}
              <code>cryptography</code>-based AES-256-GCM, keys zeroized after use.
            </p>
          </div>
          <div className="lang-card">
            <span className="tag accent">typescript</span>
            <h3>Browser</h3>
            <p>
              This site. WebCrypto in your tab — upload, masked env viewer, projects &amp;
              teams administration. Nothing decrypted server-side.
            </p>
          </div>
          <div className="lang-card">
            <span className="tag accent">any language</span>
            <h3>HTTP API</h3>
            <p>
              JWT-authenticated JSON endpoints for data keys and presigned S3 URLs. Bring
              Go, Rust, or a shell script — the envelope spec is ~40 lines.
            </p>
          </div>
        </div>
      </section>

      {/* ---- editions ------------------------------------------------ */}
      <section className="land-section" id="editions">
        <h2>Editions</h2>
        <p className="sub">
          Open-core: the encrypted vault is free and open source, forever. Team management
          ships in the enterprise edition.
        </p>
        <div className="ed-grid">
          <div className={`ed-card ${edition === "opensource" ? "current" : ""}`}>
            <div className="ed-head">
              <h3>Open Source</h3>
              <span className="tag">MIT-style · self-host</span>
              {edition === "opensource" && <span className="tag accent">this deployment</span>}
            </div>
            <ul>
              <li>End-to-end encrypted projects &amp; stages</li>
              <li>Web upload + masked KEY=VALUE viewer</li>
              <li>Python CLI, byte-compatible envelopes</li>
              <li>Invite-only email OTP login</li>
              <li>Your AWS account: S3 + KMS + Lambda</li>
            </ul>
          </div>
          <div className={`ed-card ${edition === "enterprise" ? "current" : ""}`}>
            <div className="ed-head">
              <h3>Enterprise</h3>
              <span className="tag">private repo</span>
              {edition === "enterprise" && <span className="tag accent">this deployment</span>}
            </div>
            <ul>
              <li>Everything in Open Source</li>
              <li>Teams: named groups of people</li>
              <li>One grant → whole-team stage access</li>
              <li>Owner-managed membership &amp; revocation</li>
              <li>Feature toggles per deployment</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- quickstart ---------------------------------------------- */}
      <section className="land-section" id="quickstart">
        <h2>Quickstart</h2>
        <div className="qs-grid">
          <div>
            <h3>
              <span className="qs-num">01</span> Web — zero install
            </h3>
            <pre className="code">{WEB_QUICKSTART}</pre>
          </div>
          <div>
            <h3>
              <span className="qs-num">02</span> CLI — sync a whole machine
            </h3>
            <pre className="code">{CLI_QUICKSTART}</pre>
          </div>
          <div>
            <h3>
              <span className="qs-num">03</span> Self-host — your AWS account
            </h3>
            <pre className="code">{DEPLOY_QUICKSTART}</pre>
          </div>
        </div>
      </section>

      {/* ---- security ------------------------------------------------ */}
      <section className="land-section">
        <h2>Security model</h2>
        <ul className="sec-list">
          <li>
            <b>Client-side encryption.</b> AES-256-GCM happens in your tab or CLI process;
            the KMS master key never leaves AWS KMS.
          </li>
          <li>
            <b>No AWS credentials on clients.</b> Every privileged action is brokered by a
            Lambda that re-checks access on each call and hands out short-lived presigned
            URLs.
          </li>
          <li>
            <b>Invite-only.</b> Only admins and invited members can even request a login
            code — unknown emails get silence, not errors.
          </li>
          <li>
            <b>Stage isolation in IAM.</b> One IAM role per stage, scoped by bucket policy
            to its own <code>project/stage/</code> prefix. prod is unreachable with a dev
            grant.
          </li>
        </ul>
      </section>

      <footer className="land-foot">
        <span className="brand">
          enclave<b>-envoy</b>
        </span>
        <span>encrypted with AES-256-GCM · keys by AWS KMS · invite-only</span>
        <Link to="/login">sign in →</Link>
      </footer>
    </div>
  );
}
