import React, { useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; back: () => void; }

function defaultTitle(state: WizardState): string {
  if (state.selectedStories.length === 0) return "";
  if (state.selectedStories.length === 1) return state.selectedStories[0].title;
  return `${state.selectedStories[0].title} (+${state.selectedStories.length - 1} more)`;
}

function defaultDescription(state: WizardState): string {
  const storySummary = state.selectedStories
    .map((s) => `- #${s.id} ${s.title}`)
    .join("\n");
  const analysisSummary = state.analysisResult
    .map((r) => `- #${r.storyId}: ${r.status}${r.gaps ? ` — gaps: ${r.gaps}` : ""}`)
    .join("\n");
  return `## User Stories\n${storySummary}\n\n## Analysis\n${analysisSummary}`;
}

export default function Step8RaisePR({ state, patch, back }: Props) {
  const [title, setTitle] = useState(defaultTitle(state));
  const [description, setDescription] = useState(defaultDescription(state));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  async function raise() {
    setLoading(true);
    setError(null);
    const res = await rpc<{ pr_url?: string; detail?: string }>("create-pr", "create-pr-result", {
      org_url: state.adoOrgUrl,
      pat: state.adoPat,
      project: state.adoProject,
      repo_name: state.adoRepoName,
      title,
      description,
      source_branch: state.fromBranch,
      target_branch: state.toBranch,
    });
    setLoading(false);
    if (res.detail) { setError(res.detail); return; }
    setPrUrl(res.pr_url ?? null);
  }

  if (prUrl) {
    return (
      <div className="step-card">
        <h2>PR Created!</h2>
        <p>Your pull request has been raised in Azure DevOps.</p>
        <p><a href={prUrl} style={{ color: "var(--vscode-textLink-foreground, #4daafc)" }}>{prUrl}</a></p>
        <p className="msg-info">The link has been opened in your browser.</p>
      </div>
    );
  }

  return (
    <div className="step-card">
      <h2>Step 8 — Raise Pull Request</h2>
      <p>
        <strong>{state.fromBranch}</strong> → <strong>{state.toBranch}</strong>
      </p>
      <div>
        <label>PR Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          style={{
            width: "100%",
            background: "var(--vscode-input-background, #3c3c3c)",
            color: "var(--vscode-input-foreground, #ccc)",
            border: "1px solid var(--vscode-input-border, #555)",
            borderRadius: 3,
            padding: "6px 10px",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            resize: "vertical",
          }}
        />
      </div>
      {error && <span className="msg-error">{error}</span>}
      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={raise} disabled={!title.trim() || loading}>
          {loading ? "Creating PR…" : "Raise PR"}
        </button>
      </div>
    </div>
  );
}
