/** Best-effort dotenv parser for display. Returns null when the file doesn't
 * look like KEY=VALUE lines, so callers can fall back to a raw view. */

export interface EnvEntry {
  key: string;
  value: string;
}

const LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/;

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  // Strip a trailing unquoted comment: FOO=bar # note
  const hash = v.search(/\s+#/);
  return hash >= 0 ? v.slice(0, hash).trim() : v;
}

export function parseEnv(text: string): EnvEntry[] | null {
  const entries: EnvEntry[] = [];
  let matched = 0;
  let meaningful = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    meaningful++;
    const m = LINE.exec(line);
    if (m) {
      matched++;
      entries.push({ key: m[1], value: unquote(m[2]) });
    }
  }
  // Only present the table view when the file is unambiguously dotenv-shaped.
  if (meaningful === 0 || matched < meaningful) return null;
  return entries;
}
