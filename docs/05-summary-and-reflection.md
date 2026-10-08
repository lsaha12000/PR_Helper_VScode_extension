# 5. Summary, Prompts, Testing and Reflection

## 1. Summary of the approach

PR Helper is a VS Code extension that checks code against ADO acceptance criteria before a PR is raised. An 8-step wizard collects the inputs: repo, branches, commits, AI provider, ADO credentials, sprint and work items. A local FastAPI backend gets the real git diff (GitPython) and the real work items (azure-devops SDK). An LLM, either GitHub Copilot through the VS Code Language Model API or any OpenAI-compatible model through LangChain, then:

1. gives each story a **PASS / PARTIAL / FAIL** verdict with evidence quoted from the diff and a list of gaps, and
2. writes a **PR title, Markdown description and reviewer comment** based on those verdicts.

The developer reviews and edits the result, and the tool creates the PR in ADO with work items, reviewers, labels and the reviewer comment attached.

AI is used only where judgement or writing is needed. Everything else is plain code, so the LLM's answers are always based on real data from git and ADO.

## 2. Prompts used and why

### 2.1 Prompt A — Story compliance analysis

**System message** ([langchain_analyzer.py:5-12](../backend/services/langchain_analyzer.py#L5-L12), identical in [analyzeWithCopilot.ts:20-23](../extension/src/llm/analyzeWithCopilot.ts#L20-L23))
```
You are a senior code reviewer. You are given a git diff and a list of user stories
with acceptance criteria.
Your task is to determine whether the code changes satisfy each user story.
Respond ONLY with a valid JSON array — no markdown, no explanation outside the JSON.
Each element must be: { "storyId": number, "status": "PASS"|"PARTIAL"|"FAIL",
"evidence": "quote or reference from diff", "gaps": "what is missing or empty string if none" }
```

**User message template**
```
## User Stories

[ID:202] User Story: Password reset via email
Description: Users who forget their password can reset it by email.
Acceptance Criteria: - POST /auth/reset-request ... - Max 3 reset requests per email per hour ...

## Git Diff
```diff
<diff, first 30,000 chars>
```
```

**Why each part is there**

| Prompt element | Reason |
|---|---|
| "senior code reviewer" | Sets a critical, detail-focused stance. A reviewer persona is less likely than a generic assistant to call incomplete work PASS. |
| "determine whether the code changes satisfy each user story" | Says the task is a *per-story* judgement, not a general code review. Without this, models tend to comment on style. |
| "ONLY … valid JSON array … no markdown" | The output goes straight into `JSON.parse` and the UI. Prose breaks it. |
| Inline schema with `"PASS"\|"PARTIAL"\|"FAIL"` | Enum values written out exactly prevent near-misses like "Passed", "Partially met" or "N/A". |
| `"storyId": number` | Lets the UI match each verdict back to the selected ADO item, which matters in multi-story runs (Sample 3). |
| `"evidence": "quote or reference from diff"` | Makes the model point at code. Unsupported verdicts are easy to spot, and it cuts down on hallucination. |
| `"gaps": "… or empty string if none"` | Gives a value for the PASS case so the model doesn't invent minor gaps to fill the field. |
| `[ID:n] Type: Title` + labelled `Description:` / `Acceptance Criteria:` | Each story is clearly separated, and `N/A` is sent for empty fields so the model doesn't guess. |
| Fenced ```` ```diff ```` block under `## Git Diff` | Separates instructions and data from code, and the `diff` hint helps the model read `+` and `-` lines correctly. |

### 2.2 Prompt B — PR content generation

**System message** ([langchain_analyzer.py:14-23](../backend/services/langchain_analyzer.py#L14-L23), identical in [WizardPanel.ts:190-198](../extension/src/WizardPanel.ts#L190-L198))
```
You are a senior software engineer writing a pull request for an Azure DevOps repository.
Given a git diff, user stories, and their compliance analysis results, generate:
1. A concise professional PR title (one line, under 80 characters)
2. A detailed Markdown PR description covering: summary of changes, stories addressed,
   analysis results, and any known gaps
3. A reviewer comment highlighting key areas to focus on, risks, and open questions
Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON.
Format: { "title": "...", "description": "...(markdown)...", "comment": "..." }
```

**User message template**
```
## Stories & Analysis

[ID:202] User Story: Password reset via email
Status: PARTIAL
Gaps: No rate limiting on /auth/reset-request

## Git Diff
```diff
<diff, first 25,000 chars>
```
```

**Why each part is there**

| Prompt element | Reason |
|---|---|
| "for an Azure DevOps repository" | ADO renders Markdown in PR descriptions, and the persona matches the team's conventions. |
| Numbered list of three outputs | One call produces all three fields. Numbering stops the model merging the description and the comment. |
| "under 80 characters" | ADO and email notifications cut off long titles. A concrete limit works better than "short". |
| Description must cover "analysis results, and any known gaps" | Puts the Step 7 verdict on the PR record, so a PARTIAL result is visible to reviewers. |
| Reviewer comment: "areas to focus on, risks, and open questions" | Steers the reviewer's attention. It becomes the first comment thread on the PR. |
| Status and Gaps passed in, not the full AC | The verdict is already decided. Passing the result instead of the raw AC stops the model re-judging and contradicting Step 7, and saves tokens. |
| Smaller diff budget (25k) | Leaves room for the stories and analysis block. |

### 2.3 Prompt iterations that informed the final wording

> **Note to author:** adjust to match your actual iteration history.

| Earlier version | Problem seen | Fix |
|---|---|---|
| "Return JSON" | Model wrapped the output in ```` ```json ```` and added an explanation paragraph | "Respond **ONLY** with a valid JSON … no markdown, no explanation outside the JSON", plus fence-stripping in the parser |
| Free-form status | Got "Mostly done", "Yes", "Partially" | Exact enum `"PASS"\|"PARTIAL"\|"FAIL"` written into the schema |
| No evidence field | Verdicts could not be checked; occasional PASS for missing work | Required `evidence` quoted from the diff |
| One prompt for analysis + PR | PR text was upbeat and verdicts got softer | Split into two calls; PR prompt gets the verdict as input |

## 3. How the solution was tested

Full details are in [03-testing-approach.md](03-testing-approach.md). In short:

- **Three controlled scenarios** with known correct answers: a clean PASS, a PARTIAL with one specific missing criterion (rate limiting), and a multi-story run with one PASS and one FAIL.
- **Run end to end** through the real wizard against a scratch ADO project and git repo, on **both providers**.
- **Checked against explicit criteria:** correct verdict, the gap names the right criterion, evidence refers to real code, `storyId` maps correctly, JSON parses, and the PR is created with links, reviewers, labels and the comment thread.
- **Consistency:** Re-analyze on the same input should not change the verdict (OpenAI path, `temperature=0`).
- **Error paths:** bad repo path, bad PAT, no Copilot sign-in, bad API key, first run with no venv. Each shows a clear message and a way to recover (Retry / Back / Reload).

## 4. Reflection

### What worked well

- **Grounding the LLM in real data.** The model gets the actual diff and the actual ADO acceptance criteria, so its verdicts are about *this* change and *these* stories, not generic advice.
- **Required evidence and gaps.** This made the output trustworthy. A developer can check a verdict in seconds, and wrong verdicts are easy to spot.
- **Three verdict states.** PASS / PARTIAL / FAIL fits how teams already talk about stories, and the coloured cards are easy to read at a glance.
- **Two providers behind one interface.** Copilot works with zero configuration where it is licensed. OpenAI / Azure OpenAI works where Copilot isn't available or a specific model is required. Neither the UI nor the prompts had to change.
- **Separate analysis and writing calls.** Verdicts stayed honest, and the PR description reliably records the gaps.
- **Self-bootstrapping backend.** The random port, `READY` handshake and auto-created venv made the Python dependency mostly invisible to the user.
- **Secrets in SecretStorage.** No credentials end up in files or settings.

### What I would improve

| Area | Improvement |
|---|---|
| **Large diffs** | A hard character cut can drop the very file that satisfies a criterion. Better: chunk per file, summarise each chunk, then judge; or rank files by relevance to the AC before cutting. At minimum, warn the user in the UI when the diff was truncated. |
| **Structured output** | Use the model's native JSON / structured-output mode (e.g. LangChain `with_structured_output` with a Pydantic schema) instead of prompt-only JSON plus string stripping. Add one automatic retry on parse failure. |
| **Determinism on Copilot** | The Copilot path doesn't set temperature. Pass model options where the API allows, so both providers are equally repeatable. |
| **Shared prompt source** | The same prompt text lives in Python and in TypeScript. Move it to one shared file (e.g. `prompts/*.txt` loaded by both) so they can't drift apart. |
| **Per-criterion verdicts** | Split the AC into individual criteria and return a verdict for each, not just per story. This gives a finer gap report and a checklist in the PR description. |
| **Confidence / "can't tell"** | Add an `UNVERIFIABLE` state (or a confidence field) for criteria that can't be judged from code alone, such as UX copy or performance targets, so the model doesn't have to force PASS or FAIL. |
| **Automated evaluation** | Turn the three samples into a golden-set test that calls `analyze_with_langchain` directly and checks verdicts, so prompt or model changes are caught by regression tests. Add pytest for the git/ADO services and Vitest for the React steps. |
| **Logging** | Add a dedicated VS Code **Output Channel** ("PR Helper") with timestamped entries for each step: diff size, truncation, provider, model, latency, token use. Today backend logs go to the debug console, which installed users won't see. |
| **Security hardening** | The ADO PAT is passed as a query parameter on some local GET calls. It stays on `127.0.0.1`, but moving it to a header or POST body would keep it out of any access logs. CORS `*` could be narrowed to the webview origin. |
| **Activation** | `activationEvents: ["*"]` starts the backend on every VS Code launch. Activating on the `pr-helper.open` command would save resources. |
