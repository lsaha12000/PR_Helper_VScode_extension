import React, { useEffect, useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState, AnalysisItem } from "../App";

interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

function providerLabel(state: WizardState): string {
  if (state.aiProvider === "openai") return `OpenAI (${state.aiModel || "gpt-4o"})`;
  return "GitHub Copilot";
}

function buildProviderConfig(state: WizardState) {
  if (state.aiProvider === "openai") {
    return { provider: "openai", apiKey: state.aiApiKey, baseUrl: state.aiBaseUrl, model: state.aiModel };
  }
  return { provider: "copilot" };
}

export default function Step7Analysis({ state, patch, next, back }: Props) {
  const [phase, setPhase] = useState<"fetching-diff" | "analyzing" | "done" | "error">("fetching-diff");
  const [results, setResults] = useState<AnalysisItem[]>(state.analysisResult);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (results.length) { setPhase("done"); return; }
    run();
  }, []);

  async function run() {
    try {
      setPhase("fetching-diff");
      const diffRes = await rpc<{ diff: string }>("get-diff", "get-diff-result", {
        repo: state.repoPath,
        from: state.fromBranch,
        to: state.toBranch,
        commits: state.selectedCommits.length ? state.selectedCommits : undefined,
      });
      patch({ diff: diffRes.diff });

      setPhase("analyzing");
      const analysisRes = await rpc<{ success: boolean; result?: AnalysisItem[]; error?: string }>(
        "analyze", "analyze-result", {
          diff: diffRes.diff,
          stories: state.selectedStories,
          providerConfig: buildProviderConfig(state),
        }
      );
      if (!analysisRes.success) throw new Error(analysisRes.error);
      const r = analysisRes.result!;
      setResults(r);
      patch({ analysisResult: r });
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }

  const allPass = results.every((r) => r.status === "PASS");

  return (
    <div className="step-card">
      <h2>Step 7 — Analysis Report</h2>

      {phase === "fetching-diff" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="spinner" />
          <span className="msg-info">Fetching diff…</span>
        </div>
      )}
      {phase === "analyzing" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="spinner" />
          <span className="msg-info">Analyzing with {providerLabel(state)}…</span>
        </div>
      )}
      {phase === "error" && (
        <>
          <span className="msg-error">{error}</span>
          <div className="btn-row">
            <button className="btn-secondary" onClick={back}>Back</button>
            <button className="btn-primary" onClick={() => { setError(null); run(); }}>Retry</button>
          </div>
        </>
      )}

      {phase === "done" && results.map((item) => {
        const story = state.selectedStories.find((s) => s.id === item.storyId);
        return (
          <div key={item.storyId} className={`analysis-item ${item.status}`}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong>#{item.storyId} {story?.title}</strong>
              <span className={`analysis-status ${item.status}`}>{item.status}</span>
            </div>
            {item.evidence && <p style={{ fontSize: "0.8rem", marginBottom: 4 }}><strong>Evidence:</strong> {item.evidence}</p>}
            {item.gaps && <p style={{ fontSize: "0.8rem", color: "var(--vscode-errorForeground, #f48771)" }}><strong>Gaps:</strong> {item.gaps}</p>}
          </div>
        );
      })}

      {phase === "done" && (
        <div className="btn-row">
          <button className="btn-secondary" onClick={back}>Back</button>
          <button className="btn-secondary" onClick={() => { setResults([]); patch({ analysisResult: [] }); run(); }}>
            Re-analyze
          </button>
          <button
            className="btn-primary"
            onClick={next}
            title={!allPass ? "Some stories are not fully covered — you can still raise a PR" : ""}
          >
            {allPass ? "Raise PR →" : "Raise PR anyway →"}
          </button>
        </div>
      )}
    </div>
  );
}
