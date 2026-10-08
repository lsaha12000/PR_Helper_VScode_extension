import React, { useState, useEffect } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step5AdoConfig({ state, patch, next, back }: Props) {
  const [orgUrl, setOrgUrl] = useState(state.adoOrgUrl || "https://dev.azure.com/");
  const [pat, setPat] = useState(state.adoPat);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (pat) return; // already have a value (from state or typing)
    rpc<{ pat: string; org_url: string }>("load-ado-credentials", "load-ado-credentials-result")
      .then((res) => {
        if (res.pat) { setPat(res.pat); setSavedHint(true); }
        if (res.org_url && !state.adoOrgUrl) setOrgUrl(res.org_url);
      })
      .catch(() => {});
  }, []);

  async function validate() {
    setLoading(true);
    setError(null);
    const res = await rpc<{ valid: boolean; error?: string }>(
      "validate-ado", "validate-ado-result", { org_url: orgUrl, pat }
    );
    setLoading(false);
    if (!res.valid) { setError(res.error ?? "Invalid credentials"); return; }
    patch({ adoOrgUrl: orgUrl, adoPat: pat });
    rpc("save-ado-credentials", "save-ado-credentials-result", { org_url: orgUrl, pat }).catch(() => {});
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 5 — Azure DevOps Configuration</h2>
      <p>Your PAT is used only within this session and is never written to disk or settings files.</p>
      {state.adoOrgUrl && <p className="msg-info">Organization URL auto-detected from your git remote.</p>}
      {savedHint && <p className="msg-info">PAT loaded from secure storage — just click Connect.</p>}
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
