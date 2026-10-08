import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BackendManager } from "./BackendManager";
import { createAnalyzer, type ProviderConfig } from "./llm/analyzerFactory";

export class WizardPanel {
  static currentPanel: WizardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly backend: BackendManager;
  private readonly secrets: vscode.SecretStorage;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    backend: BackendManager,
    extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage
  ) {
    this.panel = panel;
    this.backend = backend;
    this.secrets = secrets;

    this.panel.webview.html = this.getHtml(extensionUri);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static createOrShow(backend: BackendManager, extensionUri: vscode.Uri, secrets: vscode.SecretStorage) {
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
    WizardPanel.currentPanel = new WizardPanel(panel, backend, extensionUri, secrets);
  }

  private async handleMessage(msg: { type: string; payload?: unknown }) {
    const base = `http://127.0.0.1:${this.backend.port}`;

    switch (msg.type) {
      case "pick-folder": {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: "Select Repository Folder",
        });
        this.post("pick-folder-result", { path: uris?.[0]?.fsPath ?? null });
        break;
      }
      case "validate-repo": {
        const res = await fetch(`${base}/git/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: (msg.payload as { path: string }).path }),
        });
        this.post("validate-repo-result", await res.json());
        break;
      }
      case "get-remote-info": {
        const { repo } = msg.payload as { repo: string };
        const res = await fetch(`${base}/git/remote-info?repo=${encodeURIComponent(repo)}`);
        this.post("get-remote-info-result", await res.json());
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
          const config: ProviderConfig = providerConfig.provider === "openai"
            ? { ...providerConfig, backendPort: this.backend.port! }
            : providerConfig;
          const analyzer = createAnalyzer(config);
          const result = await analyzer.analyze(diff, stories as Parameters<typeof analyzer.analyze>[1]);
          this.post("analyze-result", { success: true, result });
        } catch (e) {
          this.post("analyze-result", { success: false, error: String(e) });
        }
        break;
      }
      case "generate-pr-content": {
        const { diff, stories, analysis, providerConfig } = msg.payload as {
          diff: string;
          stories: unknown[];
          analysis: unknown[];
          providerConfig: ProviderConfig;
        };
        try {
          if (providerConfig.provider === "openai") {
            const { apiKey, baseUrl, model } = providerConfig as { provider: "openai"; apiKey: string; baseUrl?: string; model?: string; backendPort: number };
            const res = await fetch(`http://127.0.0.1:${this.backend.port}/analyze/pr-content`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                diff,
                stories,
                analysis,
                api_key: apiKey,
                base_url: baseUrl ?? "https://api.openai.com/v1",
                model: model ?? "gpt-4o",
              }),
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            this.post("generate-pr-content-result", { success: true, result });
          } else {
            // Copilot path
            const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
            if (!models.length) throw new Error("No GitHub Copilot model available.");
            const model = models[0];

            const storiesText = (stories as Array<{ id: number; type?: string; title: string; description?: string; acceptance_criteria?: string }>)
              .map((s) => {
                const a = (analysis as Array<{ storyId: number; status: string; gaps?: string }>).find((x) => x.storyId === s.id);
                return `[ID:${s.id}] ${s.type ?? "User Story"}: ${s.title}\nStatus: ${a?.status ?? "N/A"}\nGaps: ${a?.gaps || "None"}`;
              })
              .join("\n\n");

            const systemMsg = vscode.LanguageModelChatMessage.Assistant(
              "You are a senior software engineer writing a pull request for an Azure DevOps repository.\n" +
              "Given a git diff, user stories, and their compliance analysis results, generate:\n" +
              "1. A concise professional PR title (one line, under 80 characters)\n" +
              "2. A detailed Markdown PR description covering: summary of changes, stories addressed, analysis results, and any known gaps\n" +
              "3. A reviewer comment highlighting key areas to focus on, risks, and open questions\n" +
              "Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON.\n" +
              'Format: { "title": "...", "description": "...(markdown)...", "comment": "..." }'
            );
            const userMsg = vscode.LanguageModelChatMessage.User(
              `## Stories & Analysis\n\n${storiesText}\n\n## Git Diff\n\`\`\`diff\n${(diff as string).slice(0, 25_000)}\n\`\`\``
            );

            const response = await model.sendRequest([systemMsg, userMsg], {}, new vscode.CancellationTokenSource().token);
            let raw = "";
            for await (const chunk of response.text) { raw += chunk; }
            const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
            this.post("generate-pr-content-result", { success: true, result: JSON.parse(clean) });
          }
        } catch (e) {
          this.post("generate-pr-content-result", { success: false, error: String(e) });
        }
        break;
      }
      case "get-members": {
        const { org_url, pat, project, query } = msg.payload as { org_url: string; pat: string; project: string; query: string };
        const res = await fetch(
          `${base}/ado/members?org_url=${encodeURIComponent(org_url)}&pat=${encodeURIComponent(pat)}&project=${encodeURIComponent(project)}&query=${encodeURIComponent(query ?? "")}`
        );
        this.post("get-members-result", await res.json());
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
        await this.secrets.store("pr-helper.adoPat", pat);
        await this.secrets.store("pr-helper.adoOrgUrl", org_url);
        this.post("save-ado-credentials-result", { ok: true });
        break;
      }
      case "load-ado-credentials": {
        const pat = await this.secrets.get("pr-helper.adoPat") ?? "";
        const org_url = await this.secrets.get("pr-helper.adoOrgUrl") ?? "";
        this.post("load-ado-credentials-result", { pat, org_url });
        break;
      }
      case "save-ai-config": {
        const { api_key, base_url, model } = msg.payload as { api_key: string; base_url: string; model: string };
        await this.secrets.store("pr-helper.aiApiKey", api_key);
        await this.secrets.store("pr-helper.aiBaseUrl", base_url);
        await this.secrets.store("pr-helper.aiModel", model);
        this.post("save-ai-config-result", { ok: true });
        break;
      }
      case "load-ai-config": {
        const api_key = await this.secrets.get("pr-helper.aiApiKey") ?? "";
        const base_url = await this.secrets.get("pr-helper.aiBaseUrl") ?? "";
        const model = await this.secrets.get("pr-helper.aiModel") ?? "";
        this.post("load-ai-config-result", { api_key, base_url, model });
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
