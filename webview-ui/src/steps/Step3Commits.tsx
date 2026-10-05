import React, { useEffect, useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Commit { sha: string; full_sha: string; message: string; author: string; date: string; }
interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step3Commits({ state, patch, next, back }: Props) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    rpc<{ commits: Commit[] }>("get-commits", "get-commits-result", {
      repo: state.repoPath, from: state.fromBranch, to: state.toBranch,
    }).then((res) => {
      setCommits(res.commits);
      setLoading(false);
    }).catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  function toggle(sha: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sha) ? next.delete(sha) : next.add(sha);
      return next;
    });
  }

  function proceed(analyzeAll: boolean) {
    patch({ selectedCommits: analyzeAll ? [] : commits.filter((c) => selected.has(c.full_sha)).map((c) => c.full_sha) });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 3 — Select Commits</h2>
      <p>All commits between <strong>{state.fromBranch}</strong> and <strong>{state.toBranch}</strong>. Check specific commits to narrow the diff, or click "Analyze All".</p>
      {loading && <div className="spinner" />}
      {error && <span className="msg-error">{error}</span>}
      {!loading && commits.length === 0 && !error && (
        <span className="msg-info">No commits found between the selected branches.</span>
      )}
      <div className="commit-list">
        {commits.map((c) => (
          <label key={c.full_sha} className="commit-item">
            <input type="checkbox" checked={selected.has(c.full_sha)} onChange={() => toggle(c.full_sha)} />
            <code>{c.sha}</code>
            <span style={{ flex: 1 }}>{c.message}</span>
            <span style={{ color: "var(--vscode-descriptionForeground)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
              {c.author} · {new Date(c.date).toLocaleDateString()}
            </span>
          </label>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-secondary" onClick={() => proceed(false)} disabled={selected.size === 0 || loading}>
          Analyze Selected ({selected.size})
        </button>
        <button className="btn-primary" onClick={() => proceed(true)} disabled={commits.length === 0 || loading}>
          Analyze All
        </button>
      </div>
    </div>
  );
}
