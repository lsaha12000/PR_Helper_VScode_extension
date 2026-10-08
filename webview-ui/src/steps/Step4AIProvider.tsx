import React, { useState, useEffect } from "react";
import { rpc } from "../api/vscode";
import type { WizardState, AIProvider } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

interface SavedConfig { api_key: string; base_url: string; model: string; }

export default function Step4AIProvider({ state, patch, next, back }: Props) {
  const [provider, setProvider] = useState<AIProvider>(state.aiProvider);
  const [apiKey, setApiKey] = useState(state.aiApiKey);
  const [baseUrl, setBaseUrl] = useState(state.aiBaseUrl || "https://api.openai.com/v1");
  const [model, setModel] = useState(state.aiModel || "");
  const [error, setError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedConfig | null>(null);
  const [useSaved, setUseSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    rpc<SavedConfig>("load-ai-config", "load-ai-config-result")
      .then((res) => {
        if (res.api_key) {
          setSaved(res);
          setUseSaved(true);
        }
      })
      .catch(() => {});
  }, []);

  async function saveConfig() {
    setSaving(true);
    await rpc("save-ai-config", "save-ai-config-result", {
      api_key: apiKey, base_url: baseUrl, model,
    }).catch(() => {});
    setSaved({ api_key: apiKey, base_url: baseUrl, model });
    setSaving(false);
    setSaveMsg("Saved.");
    setTimeout(() => setSaveMsg(null), 2000);
  }

  function proceed() {
    if (provider === "openai") {
      const key = useSaved && saved ? saved.api_key : apiKey;
      const url = useSaved && saved ? saved.base_url : baseUrl;
      const mdl = useSaved && saved ? saved.model : model;
      if (!key.trim()) { setError("API key is required"); return; }
      if (!mdl.trim()) { setError("Deployment / model name is required"); return; }
      patch({ aiProvider: "openai", aiApiKey: key, aiBaseUrl: url, aiModel: mdl });
    } else {
      patch({ aiProvider: "copilot", aiApiKey: "", aiBaseUrl: "", aiModel: "" });
    }
    next();
  }

  const cardBorder = (p: AIProvider) =>
    `2px solid ${provider === p ? "var(--vscode-button-background, #0e639c)" : "var(--vscode-input-border, #555)"}`;

  return (
    <div className="step-card">
      <h2>Step 4 — AI Provider</h2>
      <p>Choose which AI will analyze your code against the user stories.</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "10px 14px", border: cardBorder("copilot"), borderRadius: 6 }}>
          <input type="radio" name="provider" value="copilot" checked={provider === "copilot"} onChange={() => setProvider("copilot")} />
          <div>
            <div style={{ fontWeight: 600 }}>GitHub Copilot</div>
            <div style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground)" }}>Uses the model signed in to Copilot. No extra key needed.</div>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "10px 14px", border: cardBorder("openai"), borderRadius: 6 }}>
          <input type="radio" name="provider" value="openai" checked={provider === "openai"} onChange={() => setProvider("openai")} />
          <div>
            <div style={{ fontWeight: 600 }}>OpenAI / Azure OpenAI</div>
            <div style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground)" }}>Any OpenAI-compatible endpoint. Paste your key and deployment name.</div>
          </div>
        </label>
      </div>

      {provider === "openai" && (
        <>
          {saved && (
            <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid var(--vscode-input-border, #555)", borderRadius: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem" }}>
                  Saved config — <strong>{saved.model}</strong> · {saved.base_url}
                </span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: "0.78rem", padding: "2px 10px" }}
                  onClick={() => setUseSaved((v) => !v)}
                >
                  {useSaved ? "Edit" : "Use saved"}
                </button>
              </div>
            </div>
          )}

          {(!saved || !useSaved) && (
            <>
              <div>
                <label>API Key</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-… or your Azure key" />
              </div>
              <div>
                <label>Base URL <span style={{ color: "var(--vscode-descriptionForeground)", fontWeight: 400 }}>(change for Azure OpenAI or a proxy)</span></label>
                <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
              </div>
              <div>
                <label>Deployment / Model name</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o, my-azure-deployment, claude-3-5-sonnet" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={saveConfig} disabled={saving || !apiKey.trim() || !model.trim()} style={{ fontSize: "0.8rem" }}>
                  {saving ? "Saving…" : "Save for later"}
                </button>
                {saveMsg && <span style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground)" }}>{saveMsg}</span>}
              </div>
            </>
          )}
        </>
      )}

      {error && <span className="msg-error">{error}</span>}

      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={proceed}>Next</button>
      </div>
    </div>
  );
}
