# 4. Implementation

This maps each implementation requirement to the code that meets it. No code was changed to produce this document.

## 1. Working code — core functionality

| Capability | Where |
|---|---|
| Extension activation, status bar, command `PR Helper: Open` | [extension/src/extension.ts](../extension/src/extension.ts) |
| Python backend lifecycle (venv bootstrap, spawn, port discovery, health check) | [extension/src/BackendManager.ts](../extension/src/BackendManager.ts) |
| Wizard host and message routing (20+ message types) | [extension/src/WizardPanel.ts](../extension/src/WizardPanel.ts) |
| 8-step wizard UI | [webview-ui/src/App.tsx](../webview-ui/src/App.tsx), [webview-ui/src/steps/](../webview-ui/src/steps/) |
| Git: validate, branches, commits, diff, ADO remote parsing | [backend/services/git_service.py](../backend/services/git_service.py) |
| ADO: PAT validation, projects, sprints, members, WIQL work items | [backend/services/ado_service.py](../backend/services/ado_service.py) |
| PR creation (reviewers, labels, work-item links, draft, initial comment) | [backend/routers/pr.py](../backend/routers/pr.py) |
| AI analysis and PR generation | [backend/services/langchain_analyzer.py](../backend/services/langchain_analyzer.py), [extension/src/llm/](../extension/src/llm/) |

## 2. README with setup instructions

The root [README.md](../README.md) covers prerequisites (VS Code 1.90+, Node 18+, Python 3.9+, ADO PAT scopes, optional Copilot / OpenAI), one-time setup with `.\setup.ps1`, launching with F5, and a walkthrough of all 8 steps.

Quick start:
```powershell
.\setup.ps1          # creates .venv, installs Python + npm deps
code .               # open repo in VS Code
# press F5 → in the Extension Development Host: Ctrl+Shift+P → "PR Helper: Open"
```

## 3. AI integration

There are **two providers** behind one interface:

```
IAnalyzer.analyze(diff, stories) → StoryAnalysis[]
        ▲                         ▲
CopilotAnalyzer             OpenAIAnalyzer
(vscode.lm.selectChatModels  (HTTP → FastAPI /analyze →
 + model.sendRequest)         LangChain ChatOpenAI.invoke)
```

- **GitHub Copilot via the VS Code Language Model API.** [analyzeWithCopilot.ts](../extension/src/llm/analyzeWithCopilot.ts) selects a Copilot chat model, sends the system and user messages, streams the response with `for await (const chunk of response.text)`, strips code fences, and parses JSON.
- **OpenAI-compatible API via LangChain.** [langchain_analyzer.py](../backend/services/langchain_analyzer.py) builds `ChatOpenAI(api_key, base_url, model, temperature=0)` and calls `.invoke([SystemMessage, HumanMessage])`. `base_url` is configurable, so OpenAI, Azure OpenAI and other OpenAI-compatible gateways all work.
- **Provider selection** happens in [analyzerFactory.ts](../extension/src/llm/analyzerFactory.ts), driven by Step 4 of the wizard.

There are two AI calls per run: compliance analysis (Step 7) and PR content generation (Step 8). The prompts are covered in [05 §2](05-summary-and-reflection.md#2-prompts-used-and-why).

## 4. Logging and process visibility

The tool shows progress at three levels:

| Level | What you see | Source |
|---|---|---|
| **Status bar** | `PR Helper: Starting…` → `Ready` / error, with "Reload Window" / "View Docs" actions on failure | [extension.ts](../extension/src/extension.ts) |
| **Progress notifications** | First-run venv creation, pip upgrade and package install shown as a VS Code progress toast | [BackendManager.ts](../extension/src/BackendManager.ts) |
| **Backend handshake** | Backend prints `READY:PORT=<n>` to stdout; the extension reads it to find the port | [backend/main.py:37](../backend/main.py#L37) |
| **Backend logs** | Python stderr (uvicorn warnings/errors, tracebacks) is forwarded to the Extension Host debug console with the prefix `[PR Helper backend]` | [BackendManager.ts:49](../extension/src/BackendManager.ts#L49) |
| **Wizard step state** | Progress dots for steps 1-8; Step 7 shows phases *"Fetching diff…"* → *"Analyzing with GitHub Copilot / OpenAI (gpt-4o)…"* → result cards, or an error with **Retry** | [Step7Analysis.tsx](../webview-ui/src/steps/Step7Analysis.tsx) |
| **Analysis output** | One card per story, coloured PASS / PARTIAL / FAIL, showing Evidence and Gaps | [Step7Analysis.tsx:87-99](../webview-ui/src/steps/Step7Analysis.tsx#L87-L99) |
| **Final output** | The created PR URL opens in the browser | [WizardPanel.ts:230](../extension/src/WizardPanel.ts#L230) |

**Viewing backend logs:** run with F5. In the *original* VS Code window, open **Debug Console**. Lines prefixed `[PR Helper backend]` come from the Python process. Uvicorn runs at `log_level="warning"`, so routine request logs are hidden and real problems stand out.

## 5. Key design decisions

Some of these are already commented in the code (for example the port-discovery comment in [main.py:29-30](../backend/main.py#L29-L30)). The rest are recorded here so the code did not need changing.

| # | Decision | Why |
|---|---|---|
| 1 | **Python backend as a subprocess** instead of pure TypeScript | The `azure-devops` Python SDK and LangChain are mature and well documented, and GitPython gives clean diff and commit APIs. The backend stays local (`127.0.0.1`), so nothing is exposed to the network. |
| 2 | **Random port with a `READY:PORT=<n>` handshake** | Avoids clashes with other local services and multiple VS Code windows. The extension does not need to guess the port. |
| 3 | **Venv bootstrapped by the extension on first run** | Users don't have to manage Python dependencies by hand, and the extension's packages don't touch the global Python. |
| 4 | **`IAnalyzer` interface + factory** | Copilot needs no API key and is often already licensed in enterprises. OpenAI / Azure OpenAI gives control over the model. The interface keeps both options without the UI caring which is used, and another provider can be added later. |
| 5 | **Copilot path runs in the extension host, OpenAI path in Python** | `vscode.lm` only exists inside the extension host. LangChain lives naturally in Python. Each provider runs where its SDK runs. |
| 6 | **Credentials in `vscode.SecretStorage`** | The PAT and API key are stored in the OS credential store, never in plain-text settings or files in the repo. |
| 7 | **Analysis and PR writing as separate LLM calls** | Separate concerns give sharper verdicts. The user can re-analyze without regenerating the PR, and the PR prompt can use the verdicts as input. |
| 8 | **Strict JSON output + PASS / PARTIAL / FAIL enum** | The UI renders the result directly. Three states are easy to act on and colour-code. |
| 9 | **Diff truncated at 30k / 25k characters** | Keeps requests inside typical context windows and keeps cost and latency predictable. PR generation gets a smaller budget because it also carries the analysis results. |
| 10 | **`temperature=0`** (OpenAI path) | Re-running on the same input should give the same verdict. A compliance checker that changes its answer is not trustworthy. |
| 11 | **Fence-stripping and wrapper-tolerant JSON parsing** | Models sometimes ignore "no markdown". Defensive parsing avoids spurious errors without retry loops. |
| 12 | **"Raise PR anyway" when not all PASS** | The tool advises and does not block. Developers sometimes raise partial PRs on purpose (stacked PRs, drafts), and the gaps are recorded in the PR description. |
| 13 | **WIQL limited to User Story / Bug / Task, capped at 50** | These are the types PRs are normally linked to, and the cap keeps the Step 6 list usable. |
| 14 | **3-level fallback for member search** | ADO team-member APIs differ by permission and org setup. Falling back from SDK → REST → "me" means reviewer search always returns something useful. |
