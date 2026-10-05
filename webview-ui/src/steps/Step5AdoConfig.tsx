import React, { useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step5AdoConfig({ state, patch, next, back }: Props) {
  const [orgUrl, setOrgUrl] = useState(state.adoOrgUrl || "https://dev.azure.com/your-org");
  const [pat, setPat] = useState(state.adoPat);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setLoading(true);
    setError(null);
    const res = await rpc<{ valid: boolean; error?: string }>(
      "validate-ado", "validate-ado-result", { org_url: orgUrl, pat }
    );
    setLoading(false);
    if (!res.valid) { setError(res.error ?? "Invalid credentials"); return; }
    patch({ adoOrgUrl: orgUrl, adoPat: pat });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 5 — Azure DevOps Configuration</h2>
      <p>Your PAT is used only within this session and is never written to disk or settings files.</p>
      <div>
        <label>Organization URL</label>
        <input type="text" value={orgUrl} onChange={(e) => setOrgUrl(e.target.value)} placeholder="https://dev.azure.com/your-org" />
      </div>
      <div>
        <label>Personal Access Token (PAT)</label>
        <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="Paste your PAT here" />
      </div>
      {error && <span className="msg-error">{error}</span>}
      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={validate} disabled={!orgUrl.trim() || !pat.trim() || loading}>
          {loading ? "Validating…" : "Connect"}
        </button>
      </div>
    </div>
  );
}
