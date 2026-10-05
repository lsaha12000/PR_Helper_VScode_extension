# PR Helper

A VS Code extension that guides developers through a structured wizard to validate their code against Azure DevOps user stories before raising a pull request.

---

## What it does

Instead of raising a PR and hoping it covers the requirements, PR Helper:

1. Reads your local git repository and branch history
2. Fetches your user stories directly from Azure DevOps Boards
3. Analyses your code diff against each story's acceptance criteria using AI (GitHub Copilot or OpenAI)
4. Shows a per-story **PASS / PARTIAL / FAIL** report
5. Creates the PR in Azure DevOps only when you are satisfied

---

## Architecture

```
PR_Helper/
├── extension/          TypeScript — VS Code extension host
│   └── src/
│       ├── extension.ts          Activation, Python backend lifecycle
│       ├── BackendManager.ts     Spawn / health-check / kill Python process
│       ├── WizardPanel.ts        WebviewPanel host, message relay
│       └── llm/
│           ├── IAnalyzer.ts      Shared analyzer interface
│           ├── analyzerFactory.ts  Provider selector
│           ├── analyzeWithCopilot.ts  GitHub Copilot implementation
│           └── OpenAIAnalyzer.ts      OpenAI implementation
│
├── webview-ui/         React + TypeScript — Wizard UI (compiled into extension)
│   └── src/
│       ├── App.tsx               8-step wizard shell
│       ├── api/vscode.ts         VS Code message bridge (postMessage RPC)
│       └── steps/
│           ├── Step1Repo.tsx           Validate local repo path
│           ├── Step2Branches.tsx       FROM / TO branch selection
│           ├── Step3Commits.tsx        Commit selection (or analyze all)
│           ├── Step4AIProvider.tsx     Copilot or OpenAI selector
│           ├── Step5AdoConfig.tsx      ADO org URL + PAT
│           ├── Step6UserStories.tsx    Project → Sprint → story checklist
│           ├── Step7Analysis.tsx       AI analysis report
│           └── Step8RaisePR.tsx        PR title, description, create
│
├── backend/            Python — FastAPI server (bundled inside extension)
│   ├── main.py                   Entry point, prints READY:PORT=<n> to stdout
│   ├── routers/
│   │   ├── git.py                /git/validate, /git/branches, /git/commits, /git/diff
│   │   ├── ado.py                /ado/validate, /ado/projects, /ado/sprints, /ado/work-items
│   │   └── pr.py                 /pr/create
│   └── services/
│       ├── git_service.py        gitpython wrapper
│       └── ado_service.py        azure-devops SDK wrapper
│
└── test_repo/          Sample repository for end-to-end testing
    ├── userstories.txt           Two reference user stories to create in ADO
    └── init_repo.ps1             One-time script: git init → two commits → push
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| VS Code | 1.90+ | |
| Node.js | 18+ | For building the extension |
| Python | 3.9+ | Must be on PATH — the backend runs as a subprocess |
| GitHub Copilot | Any plan | Only if using the Copilot AI provider |
| OpenAI API key | — | Only if using the OpenAI AI provider |
| Azure DevOps access | — | PAT with **Code (Read + Write)** and **Work Items (Read)** |

---

## Installation (development)

```powershell
# From the PR_Helper root
.\setup.ps1
```

This runs `pip install` for the backend and `npm install` for both the extension and the webview UI.

### Manual install

```powershell
# Backend
pip install -r backend/requirements.txt

# Extension
cd extension
npm install

# Webview UI
cd ../webview-ui
npm install
```

---

## Running in development

1. Open the `extension/` folder in VS Code
2. Press **F5** — launches the Extension Development Host
3. In the new window: `Ctrl+Shift+P` → **PR Helper: Open**

---

## Wizard flow

```
Step 1  Repo          →  Validate local git repository path
Step 2  Branches      →  Select FROM branch (your work) and TO branch (merge target)
Step 3  Commits       →  Pick specific commits or analyze all since last merge
Step 4  AI Provider   →  GitHub Copilot  or  OpenAI (API key + model + base URL)
Step 5  ADO Config    →  Organization URL + Personal Access Token (session-only)
Step 6  User Stories  →  Project → Sprint → select stories to validate against
Step 7  Analysis      →  AI generates PASS / PARTIAL / FAIL per story with evidence
Step 8  Raise PR      →  Review pre-filled title + description → create PR in ADO
```

---

## AI Providers

### GitHub Copilot
No configuration needed beyond being signed in to Copilot in VS Code. Uses the VS Code Language Model API (`vscode.lm`).

### OpenAI
Enter your API key in Step 4. Supports:

| Setting | Default | Notes |
|---|---|---|
| Model | `gpt-4o` | Also supports `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Base URL | `https://api.openai.com/v1` | Change for Azure OpenAI or any OpenAI-compatible proxy |

**Azure OpenAI example:**
- Base URL: `https://<your-resource>.openai.azure.com/openai/deployments/<deployment>/`
- API Key: your Azure OpenAI key

---

## Security

| Data | How it is handled |
|---|---|
| ADO PAT | Held in memory for the session only — never written to disk or `settings.json` |
| OpenAI API key | Held in memory for the session only |
| Git diff | Sent to the AI provider you selected — review your provider's data handling policy |
| Work item content | Sent to the AI provider you selected |

---

## Building for packaging

```powershell
# From extension/
npm run vscode:prepublish
```

This compiles the webview UI with Vite and bundles the extension with esbuild. Output goes to `extension/dist/`.

To package as a `.vsix`:

```powershell
cd extension
npx vsce package
```

---

## Testing with the sample repository

A ready-made test scenario is provided in `test_repo/`.

**1. Create the ADO repository and push the test branches:**

```powershell
cd test_repo
.\init_repo.ps1 -RemoteUrl "https://dev.azure.com/YOUR-ORG/YOUR-PROJECT/_git/expense-claim-api"
```

**2. Create the two user stories in ADO** using the titles and acceptance criteria in [test_repo/userstories.txt](test_repo/userstories.txt). Assign both to the same sprint.

**3. Open PR Helper and walk the wizard:**

- Step 1 → path to `test_repo\`
- Step 2 → FROM: `feature/expense-claims`, TO: `main`
- Step 3 → Analyze All
- Step 4 → pick your AI provider
- Step 5 → your ADO org URL + PAT
- Step 6 → select your project, Sprint 1, and both user stories
- Step 7 → analysis runs; both stories should show **PASS**
- Step 8 → raise the PR

---

## Troubleshooting

**"Failed to start backend"**
Python 3.9+ is not on PATH. Verify with `python --version` in a terminal.

**"No GitHub Copilot model available"**
You are not signed in to Copilot in VS Code, or your plan does not include API access. Sign in via the Accounts menu or switch to the OpenAI provider.

**"OpenAI API error 401"**
The API key is invalid or expired. Generate a new one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

**"Repository 'x' not found in project 'y'"**
The repository name in Step 6 must match the exact name as it appears in ADO Repos, not the project name.

**Analysis returns only FAIL**
The diff was likely too large (capped at 30 000 characters). Use Step 3 to narrow down to the specific commits that implement the user stories.

---

## Project status

This is an internal tooling project. Contributions should follow the branching convention `feature/<work-item-id>-<short-description>`.
