import React, { useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; }

export default function Step1Repo({ state, patch, next }: Props) {
  const [path, setPath] = useState(state.repoPath);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFolder() {
    setPicking(true);
    const res = await rpc<{ path: string | null }>("pick-folder", "pick-folder-result");
    setPicking(false);
    if (res.path) setPath(res.path);
  }

  async function validate() {
    setLoading(true);
    setError(null);
    const res = await rpc<{ valid: boolean; error?: string }>(
      "validate-repo", "validate-repo-result", { path }
    );
    if (!res.valid) {
      setLoading(false);
      setError(res.error ?? "Not a valid git repository");
      return;
    }
    const remote = await rpc<{ org_url: string | null; project: string | null; repo_name: string | null }>(
      "get-remote-info", "get-remote-info-result", { repo: path }
    );
    setLoading(false);
    patch({
      repoPath: path,
      ...(remote.org_url ? { adoOrgUrl: remote.org_url } : {}),
      ...(remote.project ? { adoProject: remote.project } : {}),
      ...(remote.repo_name ? { adoRepoName: remote.repo_name } : {}),
    });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 1 — Select Repository</h2>
      <p>Browse for your local git repository folder, or paste the path directly.</p>
      <div>
        <label>Repository path</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:\Users\you\projects\my-repo"
            onKeyDown={(e) => e.key === "Enter" && validate()}
            style={{ flex: 1 }}
          />
          <button className="btn-secondary" onClick={pickFolder} disabled={picking} title="Browse for folder">
            {picking ? "…" : "Browse…"}
          </button>
        </div>
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
