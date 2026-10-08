import React, { useState, useEffect } from "react";
import { rpc } from "../api/vscode";
import type { WizardState, ReviewerItem } from "../App";

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  back: () => void;
  cancel: () => void;
}

function buildProviderConfig(state: WizardState) {
  if (state.aiProvider === "openai") {
    return { provider: "openai", apiKey: state.aiApiKey, baseUrl: state.aiBaseUrl, model: state.aiModel };
  }
  return { provider: "copilot" };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--vscode-input-background, #3c3c3c)",
  color: "var(--vscode-input-foreground, #ccc)",
  border: "1px solid var(--vscode-input-border, #555)",
  borderRadius: 3,
  padding: "6px 10px",
  fontFamily: "inherit",
  fontSize: "0.85rem",
  boxSizing: "border-box",
};

export default function Step8RaisePR({ state, patch, back, cancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [allMembers, setAllMembers] = useState<ReviewerItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [reviewers, setReviewers] = useState<ReviewerItem[]>(state.prReviewers);

  const [labelInput, setLabelInput] = useState(state.prLabels.join(", "));
  const [isDraft, setIsDraft] = useState(state.prIsDraft);

  const [raising, setRaising] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    setMembersLoading(true);
    rpc<{ members?: ReviewerItem[]; detail?: string }>(
      "get-members", "get-members-result",
      { org_url: state.adoOrgUrl, pat: state.adoPat, project: state.adoProject, query: "" }
    ).then((res) => { setAllMembers(res.members ?? []); setMembersLoading(false); })
     .catch(() => setMembersLoading(false));
  }, []);

  async function generateContent() {
    setGenerating(true);
    setGenError(null);
    const res = await rpc<{ success: boolean; result?: { title: string; description: string; comment: string }; error?: string }>(
      "generate-pr-content",
      "generate-pr-content-result",
      {
        diff: state.diff,
        stories: state.selectedStories,
        analysis: state.analysisResult,
        providerConfig: buildProviderConfig(state),
      }
    );
    setGenerating(false);
    if (!res.success || !res.result) {
      setGenError(res.error ?? "Generation failed");
      return;
    }
    setTitle(res.result.title);
    setDescription(res.result.description);
    setComment(res.result.comment);
  }

  function addReviewer(member: ReviewerItem) {
    if (reviewers.find((r) => r.id === member.id)) return;
    const updated = [...reviewers, member];
    setReviewers(updated);
    patch({ prReviewers: updated });
  }

  function removeReviewer(id: string) {
    const updated = reviewers.filter((r) => r.id !== id);
    setReviewers(updated);
    patch({ prReviewers: updated });
  }

  function parsedLabels(): string[] {
    return labelInput.split(",").map((l) => l.trim()).filter(Boolean);
  }

  async function raisePR() {
    setRaising(true);
    setRaiseError(null);
    const labels = parsedLabels();
    patch({ prLabels: labels, prIsDraft: isDraft, prComment: comment });
    const res = await rpc<{ pr_url?: string; detail?: string }>("create-pr", "create-pr-result", {
      org_url: state.adoOrgUrl,
      pat: state.adoPat,
      project: state.adoProject,
      repo_name: state.adoRepoName,
      title,
      description,
      source_branch: state.fromBranch,
      target_branch: state.toBranch,
      reviewers,
      labels,
      work_item_ids: state.selectedStories.map((s) => s.id),
      is_draft: isDraft,
      initial_comment: comment,
    });
    setRaising(false);
    if (res.detail) { setRaiseError(res.detail); return; }
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

  const canRaise = title.trim().length > 0 && !raising;

  return (
    <div className="step-card">
      <h2>Step 8 — Raise Pull Request</h2>
      <p style={{ marginBottom: 12 }}>
        <strong>{state.fromBranch}</strong> → <strong>{state.toBranch}</strong>
      </p>

      {/* AI Generate */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn-secondary" onClick={generateContent} disabled={generating} style={{ marginRight: 8 }}>
          {generating ? "Generating…" : "✨ Generate with AI"}
        </button>
        <span style={{ fontSize: "0.78rem", color: "var(--vscode-descriptionForeground, #999)" }}>
          Auto-fills title, description &amp; reviewer comment
        </span>
        {genError && <p className="msg-error" style={{ marginTop: 6 }}>{genError}</p>}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>PR Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Enter PR title…" />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>Description (Markdown)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Describe your changes…"
        />
      </div>

      {/* Reviewer Comment */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>Initial Comment (posted on PR)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Add a comment for reviewers…"
        />
      </div>

      {/* Reviewers */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>Reviewers <span style={{ color: "var(--vscode-descriptionForeground, #999)", fontWeight: "normal" }}>(optional)</span></label>
        {membersLoading ? (
          <div className="spinner" />
        ) : allMembers.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--vscode-descriptionForeground, #999)", margin: "4px 0 8px" }}>
            No other project members found — you can raise the PR without reviewers.
          </p>
        ) : (
          <select
            style={{ ...inputStyle, marginBottom: 6 }}
            value=""
            onChange={(e) => {
              const member = allMembers.find((m) => m.id === e.target.value);
              if (member) addReviewer(member);
            }}
          >
            <option value="">{`— select a reviewer (${allMembers.filter(m => !reviewers.find(r => r.id === m.id)).length} available) —`}</option>
            {allMembers
              .filter((m) => !reviewers.find((r) => r.id === m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}{m.uniqueName ? ` (${m.uniqueName})` : ""}
                </option>
              ))}
          </select>
        )}
        {reviewers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {reviewers.map((r) => (
              <span
                key={r.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  background: "var(--vscode-badge-background, #4d4d4d)",
                  color: "var(--vscode-badge-foreground, #ccc)",
                  borderRadius: 12,
                  fontSize: "0.78rem",
                }}
              >
                {r.displayName || r.uniqueName}
                <span
                  onClick={() => removeReviewer(r.id)}
                  style={{ cursor: "pointer", marginLeft: 2, fontWeight: "bold" }}
                  title="Remove"
                >×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Labels / Tags */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>Labels / Tags</label>
        <input
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          style={inputStyle}
          placeholder="e.g. backend, bug-fix, sprint-12 (comma separated)"
        />
      </div>

      {/* Work items (auto-linked from selected stories) */}
      {state.selectedStories.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>Linked Work Items (from Step 6)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.selectedStories.map((s) => (
              <span
                key={s.id}
                style={{
                  padding: "2px 8px",
                  background: "var(--vscode-badge-background, #4d4d4d)",
                  color: "var(--vscode-badge-foreground, #ccc)",
                  borderRadius: 12,
                  fontSize: "0.78rem",
                }}
              >
                #{s.id} {s.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Draft toggle */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id="draft-toggle"
          type="checkbox"
          checked={isDraft}
          onChange={(e) => setIsDraft(e.target.checked)}
        />
        <label htmlFor="draft-toggle" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
          Create as Draft PR
        </label>
      </div>

      {raiseError && <span className="msg-error" style={{ display: "block", marginBottom: 10 }}>{raiseError}</span>}

      <div className="btn-row">
        <button
          className="btn-secondary"
          onClick={cancel}
          style={{ color: "var(--vscode-errorForeground, #f48771)" }}
        >
          Cancel
        </button>
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={raisePR} disabled={!canRaise}>
          {raising ? "Creating PR…" : isDraft ? "Create Draft PR" : "Raise PR"}
        </button>
      </div>
    </div>
  );
}
