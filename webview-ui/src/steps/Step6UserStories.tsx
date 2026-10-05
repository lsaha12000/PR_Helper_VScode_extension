import React, { useEffect, useState } from "react";
import { rpc } from "../api/vscode";
import type { WizardState, StoryItem } from "../App";

interface Sprint { id: string; name: string; path: string; }
interface Project { id: string; name: string; }
interface Props { state: WizardState; patch: (p: Partial<WizardState>) => void; next: () => void; back: () => void; }

export default function Step6UserStories({ state, patch, next, back }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState(state.adoProject);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set(state.selectedStories.map((s) => s.id)));
  const [repoName, setRepoName] = useState(state.adoRepoName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    rpc<{ projects: Project[] }>("get-projects", "get-projects-result", { org_url: state.adoOrgUrl, pat: state.adoPat })
      .then((res) => { setProjects(res.projects); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    rpc<{ sprints: Sprint[] }>("get-sprints", "get-sprints-result", { org_url: state.adoOrgUrl, pat: state.adoPat, project })
      .then((res) => { setSprints(res.sprints); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [project]);

  useEffect(() => {
    if (!sprint) return;
    setLoading(true);
    rpc<{ items: StoryItem[] }>("get-work-items", "get-work-items-result", {
      org_url: state.adoOrgUrl, pat: state.adoPat, project, sprint_path: sprint.path,
    }).then((res) => { setStories(res.items); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [sprint]);

  function toggle(id: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function proceed() {
    if (selected.size === 0) { setError("Select at least one user story"); return; }
    patch({
      adoProject: project,
      adoRepoName: repoName,
      selectedStories: stories.filter((s) => selected.has(s.id)),
    });
    next();
  }

  return (
    <div className="step-card">
      <h2>Step 6 — User Stories</h2>
      <p>Select the project, sprint, and the user stories this PR addresses.</p>
      {error && <span className="msg-error">{error}</span>}
      <div>
        <label>Project</label>
        <select value={project} onChange={(e) => { setProject(e.target.value); setSprints([]); setSprint(null); setStories([]); }}>
          <option value="">— select project —</option>
          {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      {sprints.length > 0 && (
        <div>
          <label>Sprint</label>
          <select value={sprint?.id ?? ""} onChange={(e) => {
            const s = sprints.find((x) => x.id === e.target.value) ?? null;
            setSprint(s);
            setStories([]);
          }}>
            <option value="">— select sprint —</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {loading && <div className="spinner" />}
      {stories.length > 0 && (
        <div className="story-list">
          {stories.map((s) => (
            <label key={s.id} className="story-item">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span className="story-badge">{s.type}</span>
              <span><strong>#{s.id}</strong> {s.title}</span>
            </label>
          ))}
        </div>
      )}
      <div>
        <label>Repository name (in ADO)</label>
        <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="my-repo-name" />
      </div>
      <div className="btn-row">
        <button className="btn-secondary" onClick={back}>Back</button>
        <button className="btn-primary" onClick={proceed} disabled={selected.size === 0 || !repoName.trim() || loading}>
          Analyze ({selected.size} {selected.size === 1 ? "story" : "stories"})
        </button>
      </div>
    </div>
  );
}
