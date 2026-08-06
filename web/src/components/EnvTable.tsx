import { useState } from "react";
import type { EnvEntry } from "../lib/envfile";

/** Parsed KEY=VALUE view. Values are masked until revealed per-row; masking is
 * a display convenience only — the plaintext already lives in page memory. */
export default function EnvTable({ entries }: { entries: EnvEntry[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  function toggle(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function copy(i: number, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1200);
  }

  return (
    <table className="env-table">
      <tbody>
        {entries.map((e, i) => (
          <tr key={`${e.key}-${i}`}>
            <td className="k">{e.key}</td>
            {revealed.has(i) ? (
              <td className="v">{e.value}</td>
            ) : (
              <td className="v masked">{"•".repeat(Math.min(Math.max(e.value.length, 6), 24))}</td>
            )}
            <td className="actions">
              <button className="btn quiet" onClick={() => toggle(i)}>
                {revealed.has(i) ? "hide" : "reveal"}
              </button>
              <button className="btn quiet" onClick={() => void copy(i, e.value)}>
                {copied === i ? "copied" : "copy"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
