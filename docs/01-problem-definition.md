# 1. Problem Definition

## 1.1 The problem

On teams that use Azure DevOps (ADO), every pull request is supposed to deliver one or more **user stories**, and each story has **acceptance criteria**. Today, checking that the code actually meets those criteria is manual, and it usually happens too late:

- **The developer** writes the PR title and description by hand, links the work items by hand, and judges for themselves whether the acceptance criteria are met. It is easy to forget a criterion, especially when one branch covers several stories.
- **The reviewer** has to read the story in ADO, read the diff in a separate tab, and map one to the other in their head. Reviews end up focusing on code style rather than "does this do what the story asked for?"
- **Gaps show up late.** A missing criterion is often found in QA or after the sprint demo, when fixing it costs more and means another PR.
- **PR descriptions vary in quality.** Some are one line, some are detailed, and few say which criteria are covered and which are not.

**Problem statement:**
> Developers have no fast, consistent way to check, *before* raising a PR, whether their code changes satisfy the acceptance criteria of the ADO user stories they are working on, and writing a good PR that records this is slow manual work.

**Goal:** A tool inside VS Code that takes the developer's real git diff and the real ADO work items, uses an LLM to give each story a **PASS / PARTIAL / FAIL** verdict with evidence and gaps, writes a PR title and description from that result, and creates the PR in ADO, all in one guided flow.

## 1.2 Use cases

### Use case 1 — Self-check before raising a PR
**Actor:** Developer finishing a feature branch.
**Scenario:** Priya has implemented story #1234, "Add password reset via email". Before opening a PR she wants to know whether she covered every acceptance criterion: token expiry, rate limiting, and the confirmation email.
**Flow:** Open PR Helper, pick the repo, choose `feature/password-reset` → `develop`, select the sprint and story #1234, run the analysis.
**Value:** If the result is PARTIAL with the gap "no rate limiting on the reset endpoint", she fixes it before any reviewer sees the code. That saves a review round-trip.

### Use case 2 — A branch that covers several stories
**Actor:** Developer whose branch touches several work items (common for bug-fix batches or small related stories).
**Scenario:** A branch fixes bug #2001 (null pointer on an empty cart) and implements story #2002 (show the cart item count in the header).
**Flow:** Select both work items in Step 6. The LLM checks the diff against each one separately.
**Value:** Each item gets its own verdict. The developer can see that #2001 is PASS and #2002 is PARTIAL (the header count does not update on removal). With a single gut-feel check, the second item is easy to miss.

### Use case 3 — PR description and reviewer guidance
**Actor:** Developer who wants to raise a well-documented PR quickly; reviewer who receives it.
**Scenario:** After the analysis, the developer goes to Step 8. The tool has already filled in a PR title (under 80 characters), a Markdown description (summary, stories covered, analysis results, known gaps), and a reviewer comment (focus areas, risks, open questions).
**Flow:** The developer edits if needed, adds reviewers and labels, optionally marks it as a draft, and clicks Create. The PR is created in ADO with the work items linked and the reviewer comment posted as the first thread.
**Value:** Every PR has the same structure, the reviewer knows where to look, and the analysis is recorded on the PR itself.

## 1.3 Scope

| In scope | Out of scope |
|---|---|
| Local git repos with an ADO `origin` remote | GitHub / GitLab PRs |
| User Stories, Bugs, Tasks from a chosen sprint | Running tests or static analysis |
| Analysis of code changes against text criteria | Proving behaviour at runtime |
| Copilot (VS Code LM API) or any OpenAI-compatible endpoint | Self-hosted model management |

## 1.4 AI tools used to refine the problem statement

> **Note to author:** fill in or correct this section with the tools you actually used. The entries below are a suggested structure, not a record of what happened.

| Tool | How it was used |
|---|---|
| *e.g. GitHub Copilot Chat / ChatGPT* | *e.g. brainstorming developer pain points around ADO PR reviews; narrowing from "AI code review" to "acceptance criteria compliance"* |
| *e.g. Copilot Chat* | *e.g. turning the problem into concrete use cases (single story, multiple stories, PR authoring)* |
| Claude Code | Producing this documentation set from the finished codebase |
