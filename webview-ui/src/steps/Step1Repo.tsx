import React, { useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; }

export default function Step1Repo({ state, patch, next }: Props) {
  const [path, setPath] = useState(state.repoPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setLoading(true);
    setError(null);
    const res = await rpc<{ valid: boolean; error?: string }>(
      "validate-repo", "validate-repo-result", { path }
    );
    setLoading(false);
    if (!res.valid) {
      setError(res.error ?? "Not a valid git repository");
      return;
    }
    patch({ repoPath: path });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 1 — Select Repository</h2>
      <p>Enter the full path to your local git repository.</p>
      <div>
        <label>Repository path</label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="C:\Users\you\projects\my-repo"
          onKeyDown={(e) => e.key === "Enter" && validate()}
        />
      </div>
      {error && <span className="msg-error">{error}</span>}
      <div className="btn-row">
        <button className="btn-primary" onClick={validate} disabled={!path.trim() || loading}>
          {loading ? "Validating…" : "Next"}
        </button>
      </div>
    </div>
  );
}
