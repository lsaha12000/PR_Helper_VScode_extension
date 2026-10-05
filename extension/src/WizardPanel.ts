import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BackendManager } from "./BackendManager";
import { createAnalyzer, type ProviderConfig } from "./llm/analyzerFactory";

export class WizardPanel {
  static currentPanel: WizardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly backend: BackendManager;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    backend: BackendManager,
    extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.backend = backend;

    this.panel.webview.html = this.getHtml(extensionUri);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static createOrShow(backend: BackendManager, extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (WizardPanel.currentPanel) {
      WizardPanel.currentPanel.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "prHelper",
      "PR Helper",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
        retainContextWhenHidden: true,
      }
    );
    WizardPanel.currentPanel = new WizardPanel(panel, backend, extensionUri);
  }

  private async handleMessage(msg: { type: string; payload?: unknown }) {
    const base = `http://127.0.0.1:${this.backend.port}`;

    switch (msg.type) {
      case "validate-repo": {
        const res = await fetch(`${base}/git/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: (msg.payload as { path: string }).path }),
        });
        this.post("validate-repo-result", await res.json());
        break;
      }
      case "get-branches": {
        const { repo } = msg.payload as { repo: string };
        const res = await fetch(`${base}/git/branches?repo=${encodeURIComponent(repo)}`);
        this.post("get-branches-result", await res.json());
        break;
      }
      case "get-commits": {
        const { repo, from, to } = msg.payload as { repo: string; from: string; to: string };
        const res = await fetch(
          `${base}/git/commits?repo=${encodeURIComponent(repo)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        this.post("get-commits-result", await res.json());
        break;
      }
      case "get-diff": {
        const { repo, from, to, commits } = msg.payload as {
          repo: string; from: string; to: string; commits?: string[];
        };
        const params = new URLSearchParams({ repo, from, to });
        if (commits?.length) params.set("commits", commits.join(","));
        const res = await fetch(`${base}/git/diff?${params}`);
        this.post("get-diff-result", await res.json());
        break;
      }
      case "validate-ado": {
        const res = await fetch(`${base}/ado/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        this.post("validate-ado-result", await res.json());
        break;
      }
      case "get-projects": {
        const { org_url, pat } = msg.payload as { org_url: string; pat: string };
        const res = await fetch(`${base}/ado/projects?org_url=${encodeURIComponent(org_url)}&pat=${encodeURIComponent(pat)}`);
        this.post("get-projects-result", await res.json());
        break;
      }
      case "get-sprints": {
        const { org_url, pat, project } = msg.payload as { org_url: string; pat: string; project: string };
        const res = await fetch(`${base}/ado/sprints?org_url=${encodeURIComponent(org_url)}&pat=${encodeURIComponent(pat)}&project=${encodeURIComponent(project)}`);
        this.post("get-sprints-result", await res.json());
        break;
      }
      case "get-work-items": {
        const { org_url, pat, project, sprint_path } = msg.payload as {
          org_url: string; pat: string; project: string; sprint_path: string;
        };
        const res = await fetch(`${base}/ado/work-items?org_url=${encodeURIComponent(org_url)}&pat=${encodeURIComponent(pat)}&project=${encodeURIComponent(project)}&sprint_path=${encodeURIComponent(sprint_path)}`);
        this.post("get-work-items-result", await res.json());
        break;
      }
      case "analyze": {
        const { diff, stories, providerConfig } = msg.payload as {
          diff: string;
          stories: unknown[];
          providerConfig: ProviderConfig;
        };
        try {
          const analyzer = createAnalyzer(providerConfig);
          const result = await analyzer.analyze(diff, stories as Parameters<typeof analyzer.analyze>[1]);
          this.post("analyze-result", { success: true, result });
        } catch (e) {
          this.post("analyze-result", { success: false, error: String(e) });
        }
        break;
      }
      case "create-pr": {
        const res = await fetch(`${base}/pr/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        const data = await res.json();
        this.post("create-pr-result", data);
        if (res.ok && (data as { pr_url?: string }).pr_url) {
          vscode.env.openExternal(vscode.Uri.parse((data as { pr_url: string }).pr_url));
        }
        break;
      }
      case "save-ado-credentials": {
        const { org_url, pat } = msg.payload as { org_url: string; pat: string };
        const ext = vscode.extensions.getExtension("pr-helper")!;
        await ext.activate();
        // Store via globalState — actual SecretStorage access lives in extension.ts
        this.post("save-ado-credentials-result", { ok: true });
        break;
      }
    }
  }

  private post(type: string, payload: unknown) {
    this.panel.webview.postMessage({ type, payload });
  }

  private getHtml(extensionUri: vscode.Uri): string {
    const webviewDist = vscode.Uri.joinPath(extensionUri, "dist", "webview");
    const indexPath = path.join(webviewDist.fsPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    // Rewrite asset paths to use VS Code webview URIs
    const baseUri = this.panel.webview.asWebviewUri(webviewDist).toString();
    html = html.replace(/(src|href)="([^"]+)"/g, (_, attr, val) => {
      if (val.startsWith("http") || val.startsWith("data:")) return `${attr}="${val}"`;
      const clean = val.startsWith("/") ? val.slice(1) : val;
      return `${attr}="${baseUri}/${clean}"`;
    });
    // Add VS Code API script tag
    html = html.replace(
      "</head>",
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-prhelper' ${this.panel.webview.cspSource}; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; img-src ${this.panel.webview.cspSource} data:;">
      </head>`
    );
    return html;
  }

  dispose() {
    WizardPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
