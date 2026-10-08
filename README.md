# PR Helper

A VS Code extension that guides developers through a structured 8-step wizard to validate code changes against Azure DevOps user stories **before** raising a pull request. It reads your git diff, fetches acceptance criteria from ADO Boards, and uses AI (GitHub Copilot or OpenAI via LangChain) to produce a per-story **PASS / PARTIAL / FAIL** report — so you catch gaps before reviewers do.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [First-time setup](#first-time-setup)
5. [Running in development (F5)](#running-in-development-f5)
6. [What happens on first launch](#what-happens-on-first-launch)
7. [Wizard walkthrough](#wizard-walkthrough)
8. [AI providers](#ai-providers)
9. [Azure DevOps PAT permissions](#azure-devops-pat-permissions)
10. [Security](#security)
11. [Installing for everyday use](#installing-for-everyday-use-no-pr_helper-folder-needed)
12. [Testing with the sample repository](#testing-with-the-sample-repository)
13. [Troubleshooting](#troubleshooting)
14. [Project status](#project-status)

---

## What it does

Traditional code reviews catch implementation problems after the fact. PR Helper moves that check earlier:

1. Points at your local git repository and selects the branches and commits you are working on
2. Connects to your Azure DevOps Boards and loads the user stories assigned to the current sprint
3. Runs an AI analysis (LangChain + OpenAI, or GitHub Copilot) comparing your diff against each story's acceptance criteria
4. Shows a per-story verdict with quoted evidence from the code and a list of any gaps
5. Pre-fills the PR title and description, then creates the PR in ADO only when you confirm

---

## Architecture

```
PR_Helper/
├── .vscode/
│   ├── launch.json         F5 launch config — opens Extension Development Host
│   └── tasks.json          Pre-launch build task (runs npm run vscode:prepublish)
│
├── extension/              TypeScript — VS Code extension host process
│   ├── src/
│   │   ├── extension.ts          Activation: validates Python 3.9+, starts backend, registers command
│   │   ├── BackendManager.ts     Creates .venv if absent, spawns backend, reads READY:PORT=<n>
│   │   ├── WizardPanel.ts        WebviewPanel host; relays messages between webview and backend
│   │   └── llm/
│   │       ├── IAnalyzer.ts            Interface: analyze(diff, stories) → StoryAnalysis[]
│   │       ├── analyzerFactory.ts      Returns CopilotAnalyzer or OpenAIAnalyzer based on Step 4
│   │       ├── analyzeWithCopilot.ts   Copilot impl via vscode.lm.selectChatModels
│   │       └── OpenAIAnalyzer.ts       Calls the backend /analyze endpoint (LangChain)
│   ├── dist/               Compiled output (created by the build — not committed)
│   ├── package.json        Extension manifest; main: ./dist/extension.js
│   └── tsconfig.json
│
├── webview-ui/             React + TypeScript — the wizard UI
│   ├── src/
│   │   ├── App.tsx               8-step wizard shell with shared WizardState
│   │   ├── api/vscode.ts         postMessage bridge to the extension host
│   │   └── steps/
│   │       ├── Step1Repo.tsx           Validate local repo path
│   │       ├── Step2Branches.tsx       FROM / TO branch picker
│   │       ├── Step3Commits.tsx        Commit range selector (or "analyze all")
│   │       ├── Step4AIProvider.tsx     Copilot vs OpenAI selector + API key input
│   │       ├── Step5AdoConfig.tsx      ADO org URL + PAT input
│   │       ├── Step6UserStories.tsx    Project → Sprint → story checklist
│   │       ├── Step7Analysis.tsx       AI analysis results (PASS / PARTIAL / FAIL cards)
│   │       └── Step8RaisePR.tsx        PR title, description, create button
│   └── vite.config.ts      Builds to ../extension/dist/webview/
│
├── backend/                Python — FastAPI server (spawned as subprocess by the extension)
│   ├── main.py             Entry point; random port; prints READY:PORT=<n>
│   ├── routers/
│   │   ├── git.py          /git/validate  /git/branches  /git/commits  /git/diff
│   │   ├── ado.py          /ado/validate  /ado/projects  /ado/sprints  /ado/work-items
│   │   ├── pr.py           /pr/create
│   │   └── analyze.py      /analyze  — LangChain-powered AI analysis endpoint
│   └── services/
│       ├── git_service.py        gitpython wrapper
│       ├── ado_service.py        azure-devops SDK wrapper
│       └── langchain_analyzer.py LangChain + ChatOpenAI analysis logic
│
├── .venv/                  Python virtual environment (auto-created on first launch — not committed)
├── test_repo/              Sample git repository for end-to-end testing
│   ├── userstories.txt     Two reference user stories to create in ADO
│   └── init_repo.ps1       git init → two commits → push to ADO
│
├── setup.ps1               One-time install script with preflight checks
└── backend/requirements.txt
```

### Data flow

```
[Webview UI]  ──postMessage──►  [Extension Host]  ──HTTP──►  [FastAPI Backend]
                                        │                           │
                                        │                     /analyze endpoint
                                        │                           │
                                        │                     [LangChain]
                                        │                           │
                                        └──vscode.lm──►  [Copilot]  └──► [OpenAI / Azure OpenAI]
```

- **OpenAI path**: extension calls `/analyze` on the Python backend → LangChain's `ChatOpenAI` calls the OpenAI API
- **Copilot path**: extension calls `vscode.lm` directly (VS Code API — cannot be done from Python)
- All git and ADO operations go through the Python backend

---

## Prerequisites

> The extension checks for Python and shows a guided error with a download link if anything is missing. Node.js is only needed to build the extension — not at runtime.

| Requirement | Minimum version | Notes |
|---|---|---|
| VS Code | 1.90+ | Open the `PR_Helper/` root folder as workspace |
| Node.js | 18 LTS+ | Needed to build the extension and webview UI; not needed at runtime |
| Python | 3.9+ | Must be on PATH as `python` or `python3` — the backend runs as a subprocess |
| GitHub Copilot | Any plan | Only if using the Copilot AI provider |
| OpenAI API key | — | Only if using the OpenAI AI provider |
| Azure DevOps access | — | PAT with **Code (Read + Write)** and **Work Items (Read)** |

Verify both are available before running setup:

```powershell
node --version   # v18 or higher
python --version # 3.9 or higher (or try python3 --version on Linux/Mac)
```

If either is missing, install it first:
- Python → [python.org/downloads](https://www.python.org/downloads/)
- Node.js → [nodejs.org](https://nodejs.org) (choose the LTS version)

---

## First-time setup

Run the setup script **once** from the `PR_Helper/` root:

```powershell
.\setup.ps1
```

`setup.ps1` runs preflight checks before doing anything:

| Check | What it does if it fails |
|---|---|
| Python 3.9+ on PATH (`python` or `python3`) | Prints the download URL and exits |
| Python version ≥ 3.9 | Shows the detected version, prints download URL, exits |
| Node.js 18+ on PATH | Prints nodejs.org link and exits |
| npm accessible | Prints reinstall hint and exits |

If all checks pass, it:
1. Creates `.venv` (isolated Python environment — does **not** touch your global Python)
2. Upgrades pip inside `.venv`
3. Installs backend Python dependencies into `.venv`
4. Runs `npm install` for the extension
5. Runs `npm install` for the webview UI

### Manual setup (if setup.ps1 fails)

```powershell
# 1. Create Python venv and install backend dependencies
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip   # must use python.exe -m pip on Windows
.venv\Scripts\pip install -r backend\requirements.txt

# 2. Extension TypeScript dependencies
cd extension
npm install
cd ..

# 3. Webview UI dependencies
cd webview-ui
npm install
cd ..
```

---

## Running in development (F5)

> **Open the `PR_Helper/` root folder in VS Code** — not `extension/` or any subfolder. The `.vscode/launch.json` at the root is configured for this layout.

### Step 1 — Build the webview once (first time only)

The webview (React UI) is **not** rebuilt on every F5 — only when you change files in `webview-ui/`. Build it manually the first time:

```powershell
cd extension
npm run build:webview
```

This produces `extension/dist/webview/index.html`. You only need to re-run this when you edit something inside `webview-ui/src/`.

### Step 2 — Press F5

```
File → Open Folder → PR_Helper/   (if not already open)
F5
```

VS Code automatically:
- Runs the pre-launch build task — `npm run build:ext` (esbuild only, ~100 ms) — compiles `extension/src/` into `extension/dist/extension.js`
- Opens a second VS Code window — the **Extension Development Host**

### Step 3 — Use the extension in the new window

In the **Extension Development Host** window you will immediately see a status bar item at the bottom:

```
$(loading~spin) PR Helper: Starting…
```

This confirms the extension loaded successfully. Once the Python backend is ready (a few seconds, or up to ~60 s on first run while the `.venv` is created):

```
$(check) PR Helper: Ready
```

**Click the status bar item** — or `Ctrl+Shift+P` → **PR Helper: Open** — to open the wizard as a tab in that window.

If the backend fails to start, the status bar turns red and an error notification appears with a **Reload Window** button.

### npm build commands reference

All commands run from inside the `extension/` folder:

| Command | What it does | When to run |
|---|---|---|
| `npm run build:ext` | esbuild — compiles `src/extension.ts` → `dist/extension.js` (~100 ms) | Automatically on every F5 |
| `npm run build:webview` | Vite — compiles `webview-ui/src/` → `dist/webview/` (~10 s) | Once on first setup; again when `webview-ui/` changes |
| `npm run vscode:prepublish` | Both of the above in sequence | Before packaging a `.vsix` |
| `npm run watch` | esbuild in watch mode — rebuilds `extension.js` on every save | During active extension development |

### Watch mode (for active extension development)

If you are iterating on TypeScript in `extension/src/`, run watch mode instead of relying on the F5 build:

```powershell
cd extension
npm run watch
```

Then press F5. esbuild watches for changes and rebuilds in milliseconds on each save. Reload the Extension Development Host window (`Ctrl+Shift+P` → **Reload Window**) to pick up changes.

---

## What happens on first launch

The moment the Extension Development Host window opens, the extension activates automatically (no command needed). Here is the full sequence:

```
Extension Development Host opens
│
├─ Status bar shows: $(loading~spin) PR Helper: Starting…
│
├─ 1. Python check (up to 5 s timeout per candidate)
│    Tries "python --version", then "python3 --version"
│    ├─ Not found → error notification + "Download Python" button → status bar: $(error) PR Helper: Python not found
│    └─ Found but < 3.9 → error with exact version + download link → stops
│
├─ 2. Virtual environment bootstrap (only if .venv is absent)
│    Progress notification: "PR Helper: Setting up Python environment…"
│    ├─ python -m venv .venv
│    ├─ python.exe -m pip install --upgrade pip
│    └─ pip install -r backend/requirements.txt
│        └─ Any failure → clear error + manual fix instructions
│
├─ 3. Backend startup
│    Spawns .venv/Scripts/python.exe backend/main.py
│    Waits up to 30 s for "READY:PORT=<n>" on stdout
│    ├─ Timeout → error notification + "Reload Window" button → status bar: $(error) PR Helper: Backend failed
│    ├─ Non-zero exit → "Backend exited with code N" + run-manually hint
│    └─ ENOENT → "Delete .venv and reload to recreate it"
│
├─ 4. Health check
│    Polls GET /health every 300 ms, up to 30 attempts (9 s total)
│    └─ All fail → "Backend health check failed" + Developer Tools hint
│
└─ Status bar shows: $(check) PR Helper: Ready
   Click it (or Ctrl+Shift+P → PR Helper: Open) to open the wizard tab
```

All errors surface as VS Code notifications with actionable buttons. The status bar is always visible so you know whether the backend is ready before clicking.

---

## Wizard walkthrough

| Step | Name | What you do |
|---|---|---|
| 1 | **Repo** | Enter the full path to your local git repository. The backend validates it with gitpython. |
| 2 | **Branches** | Select the **FROM** branch (your feature branch) and the **TO** branch (the merge target, e.g. `main`). |
| 3 | **Commits** | Choose specific commits to analyze, or select **Analyze All** to include everything between the two branches. |
| 4 | **AI Provider** | Pick **GitHub Copilot** (no config needed if signed in) or **OpenAI** (enter API key, model, base URL). |
| 5 | **ADO Config** | Enter your Azure DevOps organization URL and Personal Access Token. Held in memory only — never saved to disk. |
| 6 | **User Stories** | Browse ADO: select your project → sprint → tick the user stories you want to validate against. |
| 7 | **Analysis** | AI reads your git diff (capped at 30 000 chars) and each story's acceptance criteria, then returns a **PASS / PARTIAL / FAIL** verdict per story with evidence quotes and gap descriptions. |
| 8 | **Raise PR** | Review the pre-filled PR title and description. Click **Create PR** to push it to ADO. |

---

## AI providers

### GitHub Copilot

No configuration required beyond being signed in to Copilot in VS Code. Uses the VS Code Language Model API (`vscode.lm.selectChatModels`). The analysis runs inside the extension host — your code diff is sent to Copilot's servers subject to your plan's data handling terms.

### OpenAI (via LangChain)

Enter your key in Step 4. The extension sends the diff and stories to the Python backend's `/analyze` endpoint, which uses **LangChain's `ChatOpenAI`** to call the OpenAI API. This keeps AI logic in Python and makes it easy to swap providers in future.

| Setting | Default | Options |
|---|---|---|
| Model | `gpt-4o` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, any custom deployment |
| Base URL | `https://api.openai.com/v1` | Change for Azure OpenAI or any OpenAI-compatible proxy |
| API Key | (required) | From [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Azure OpenAI example:**

| Setting | Value |
|---|---|
| Base URL | `https://<resource>.openai.azure.com/openai/deployments/<deployment>/` |
| Model | Your deployment name |
| API Key | Your Azure OpenAI key |

---

## Azure DevOps PAT permissions

When creating your PAT at `https://dev.azure.com/<org>/_usersSettings/tokens`, grant:

| Scope | Permission |
|---|---|
| Code | Read & Write |
| Work Items | Read |

A PAT with only Read on Code is sufficient if you never intend to create PRs (analysis-only mode).

---

## Security

| Data | How it is handled |
|---|---|
| ADO PAT | In memory for the session only — never written to disk or `settings.json` |
| OpenAI API key | In memory for the session only; sent to the local Python backend over localhost only |
| Git diff | Sent to your chosen AI provider — review your provider's data handling policy |
| Work item content | Sent to your chosen AI provider |
| `.venv/` | Local to your machine, excluded from git |

No credentials are stored between sessions. You will be prompted to re-enter them each time you open the wizard.

---

## Installing for everyday use (no PR_Helper folder needed)

> **Development mode (F5) requires the `PR_Helper/` folder to be open in VS Code.**
> If you just want to *use* the extension in your normal projects without keeping PR_Helper open, package and install it as a `.vsix` — after that it works in any VS Code window like any other extension.

### Step 1 — Install the packaging tool (one-time)

```powershell
npm install -g @vscode/vsce
```

### Step 2 — Build and package

```powershell
cd extension
npm run vscode:prepublish   # compiles webview (Vite) + extension (esbuild) into dist/
npx vsce package --allow-missing-repository --allow-star-activation
```

> **Why the extra flags?**
>
> `vsce` raises two warnings that block packaging without confirmation:
>
> | Flag | Warning suppressed | Why it is safe here |
> |---|---|---|
> | `--allow-missing-repository` | No `repository` field in `package.json` | This is internal tooling — no public repo needed |
> | `--allow-star-activation` | `"activationEvents": ["*"]` activates on every VS Code startup | Intentional — the extension needs to start the Python backend as early as possible so it is ready when you open the wizard |

### Step 3 — Install the .vsix in VS Code

1. `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
2. Browse to the `.vsix` file inside the `extension/` folder
3. Reload VS Code when prompted

After this, `Ctrl+Shift+P` → **PR Helper: Open** is available in **every VS Code window** on your machine. You never need to open `PR_Helper/` again.

---

### Developing while keeping another project open

If you are actively working on the extension and need both windows at the same time:

1. Keep your project open in the current VS Code window
2. `File → New Window` to open a second VS Code instance
3. In the new window: `File → Open Folder` → select `PR_Helper/`
4. Press **F5** in that window — the Extension Development Host opens as a third window

The three windows are fully independent.

---

## Building for packaging (reference)

The two commands used internally by the steps above:

```powershell
# From extension/
npm run vscode:prepublish   # build:webview + build:ext
npx vsce package --allow-missing-repository --allow-star-activation
```

`vscode:prepublish` runs:
1. `cd ../webview-ui && npm run build` — Vite builds the React app into `extension/dist/webview/`
2. `esbuild src/extension.ts ...` — bundles the extension into `extension/dist/extension.js`

---

## Testing with the sample repository

A ready-made two-commit test scenario is provided in `test_repo/`.

**Step 1 — Push the test branches to ADO:**

```powershell
cd test_repo
.\init_repo.ps1 -RemoteUrl "https://dev.azure.com/YOUR-ORG/YOUR-PROJECT/_git/expense-claim-api"
```

**Step 2 — Create the user stories in ADO:**

Open [test_repo/userstories.txt](test_repo/userstories.txt) and create the two user stories in your ADO project. Copy the titles and acceptance criteria exactly. Assign both to the same sprint.

**Step 3 — Walk the wizard:**

| Step | Value |
|---|---|
| Repo path | full path to `test_repo\` |
| FROM branch | `feature/expense-claims` |
| TO branch | `main` |
| Commits | Analyze All |
| AI provider | your choice |
| ADO org + PAT | your credentials |
| Sprint | Sprint 1 (or whichever sprint you used) |
| Stories | both stories |

Expected outcome: Step 7 shows **PASS** for both stories.

---

## Troubleshooting

### Python not found / "PR Helper requires Python 3.9+"

The extension checks for `python` and `python3` on startup. If neither is found:

1. Install Python 3.9+ from [python.org/downloads](https://www.python.org/downloads/)
2. During installation on Windows, tick **"Add Python to PATH"**
3. Reload the VS Code window (`Ctrl+Shift+P` → **Reload Window**)

On Linux/Mac, ensure `python3` is on PATH. Verify with:

```bash
python3 --version
```

### Python version is too old

If `python --version` returns 2.x or 3.8 or earlier, install a newer version from [python.org](https://www.python.org/downloads/) and ensure the new version is first on your PATH.

### Node.js not found / "npm is not recognized"

Install Node.js 18 LTS from [nodejs.org](https://nodejs.org). Restart your terminal after installation. Verify:

```powershell
node --version  # v18 or higher
npm --version
```

### F5 does nothing / "No launch configuration"

Make sure you opened the `PR_Helper/` root folder in VS Code — not the `extension/` or `webview-ui/` subfolder. The `.vscode/launch.json` is at the root.

### "Setting up Python environment…" notification appears then fails

The automatic `.venv` creation failed. Common causes:

| Cause | Fix |
|---|---|
| Python not on PATH | Install Python 3.9+ and add to PATH |
| No internet access | Install behind proxy: set `pip` proxy env vars and re-run `.\setup.ps1` |
| Disk space | Free up space and retry |
| Antivirus blocking pip | Temporarily disable AV or add `.venv\` to its exclusions |

To create the venv manually:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt
```

Then reload the VS Code window.

### "Failed to start backend" / "Backend exited with code N"

Run the backend manually to see the raw error:

```powershell
cd backend
..\venv\Scripts\python main.py
```

Common causes:
- A required package is missing → re-run `.\setup.ps1`
- Port conflict → restart VS Code; the backend picks a new random port each time

### "Delete .venv and reload to recreate it"

The `.venv` exists but is broken (e.g. Python was upgraded):

```powershell
Remove-Item -Recurse -Force .venv
# Then reload the VS Code window — the extension recreates it automatically
```

### Pre-launch build fails ("Cannot find module esbuild")

npm dependencies are missing inside `extension/`:

```powershell
cd extension
npm install
```

### "No GitHub Copilot model available"

You are not signed in to Copilot in VS Code, or your subscription does not include the Language Model API. Sign in via the Accounts menu (bottom-left) or switch to the OpenAI provider in Step 4.

### "Analysis error 401" / "OpenAI API error 401 Unauthorized"

The API key is invalid or expired. Generate a new one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### "Repository 'x' not found in project 'y'"

The ADO repository name must match exactly as it appears in ADO Repos — check it at `https://dev.azure.com/<org>/<project>/_git`.

### Analysis returns only FAIL

The diff is likely too large (capped at 30 000 characters). Use Step 3 to narrow scope to the specific commits that implement the user stories.

### Webview shows blank / "index.html not found"

The webview has not been built. Press F5 again (the pre-launch task builds it), or build manually:

```powershell
cd webview-ui
npm run build
```

### Backend health check failed

The server started but is not responding to `/health`. Open the Developer Tools console in the Extension Development Host (`Help → Toggle Developer Tools`) for the raw error.

---

## Project status

Internal tooling project. Branch naming convention: `feature/<work-item-id>-<short-description>`.
