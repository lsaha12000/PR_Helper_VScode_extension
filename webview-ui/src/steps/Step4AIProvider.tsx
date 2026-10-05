import React, { useState } from "react";
import type { WizardState, AIProvider } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step4AIProvider({ state, patch, next, back }: Props) {
  const [provider, setProvider] = useState<AIProvider>(state.aiProvider);
  const [apiKey, setApiKey] = useState(state.aiApiKey);
  const [baseUrl, setBaseUrl] = useState(state.aiBaseUrl || "https://api.openai.com/v1");
  const [model, setModel] = useState(state.aiModel || "gpt-4o");
  const [error, setError] = useState<string | null>(null);

  function proceed() {
    if (provider === "openai" && !apiKey.trim()) {
      setError("API key is required for OpenAI");
      return;
    }
    patch({ aiProvider: provider, aiApiKey: apiKey, aiBaseUrl: baseUrl, aiModel: model });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 4 — AI Provider</h2>
      <p>Choose which AI model will analyze your code against the user stories.</p>

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "10px 14px", border: `2px solid ${provider === "copilot" ? "var(--vscode-button-background, #0e639c)" : "var(--vscode-input-border, #555)"}`, borderRadius: 6 }}>
          <input type="radio" name="provider" value="copilot" checked={provider === "copilot"} onChange={() => setProvider("copilot")} />
          <div>
            <div style={{ fontWeight: 600 }}>GitHub Copilot</div>
            <div style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground)" }}>Uses the model signed in to Copilot. No extra key needed.</div>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "10px 14px", border: `2px solid ${provider === "openai" ? "var(--vscode-button-background, #0e639c)" : "var(--vscode-input-border, #555)"}`, borderRadius: 6 }}>
          <input type="radio" name="provider" value="openai" checked={provider === "openai"} onChange={() => setProvider("openai")} />
          <div>
            <div style={{ fontWeight: 600 }}>OpenAI</div>
            <div style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground)" }}>GPT-4o or any OpenAI-compatible endpoint. Requires an API key.</div>
          </div>
        </label>
      </div>

      {provider === "openai" && (
        <>
          <div>
            <label>OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div>
            <label>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>
          <div>
            <label>Base URL <span style={{ color: "var(--vscode-descriptionForeground)", fontWeight: 400 }}>(change for Azure OpenAI or a proxy)</span></label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
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
