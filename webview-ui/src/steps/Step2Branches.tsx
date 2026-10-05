import React, { useEffect, useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step2Branches({ state, patch, next, back }: Props) {
  const [branches, setBranches] = useState<string[]>(state.allBranches);
  const [from, setFrom] = useState(state.fromBranch);
  const [to, setTo] = useState(state.toBranch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length) return;
    setLoading(true);
    rpc<{ current: string; branches: string[] }>("get-branches", "get-branches-result", { repo: state.repoPath })
      .then((res) => {
        setBranches(res.branches);
        setFrom(res.current);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  function proceed() {
    if (!from || !to) { setError("Select both branches"); return; }
    if (from === to) { setError("FROM and TO must be different branches"); return; }
    patch({ fromBranch: from, toBranch: to, allBranches: branches });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 2 — Select Branches</h2>
      <p>Choose the source branch (your work) and the target branch (where the PR will merge into).</p>
      {loading && <div className="spinner" />}
      {error && <span className="msg-error">{error}</span>}
      <div>
        <label>FROM branch (your changes)</label>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">— select —</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label>TO branch (merge target)</label>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">— select —</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={proceed} disabled={!from || !to || loading}>Next</button>
      </div>
    </div>
  );
}
