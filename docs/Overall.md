# PR Helper — Project Documentation

This folder has the project write-up. Setup and run instructions are in the root [README.md](../README.md).

| # | Document | Covers |
|---|----------|--------|
| 1 | [01-problem-definition.md](01-problem-definition.md) | The problem, three use cases, AI tools used to refine the problem statement |
| 2 | [02-solution-design.md](02-solution-design.md) | Architecture diagram, data flow, where AI is used, prompt design approach |
| 3 | [03-testing-approach.md](03-testing-approach.md) | Three sample scenarios, what good output looks like, manual verification steps |
| 4 | [04-implementation.md](04-implementation.md) | How the code meets each implementation requirement, logging, key design decisions |
| 5 | [05-summary-and-reflection.md](05-summary-and-reflection.md) | Summary of the approach, example prompts and why they work, how it was tested, reflection |

## Requirement checklist

| Requirement | Where |
|---|---|
| Problem description and 2-3 use cases | [01](01-problem-definition.md) |
| AI tools used to refine the problem | [01 §1.4](01-problem-definition.md#14-ai-tools-used-to-refine-the-problem-statement) |
| Architecture diagram (components, data flow, AI touchpoints) | [02 §2.1-2.4](02-solution-design.md) |
| Prompt design approach | [02 §2.5](02-solution-design.md#25-prompt-design-approach) |
| AI help in the design phase | [02 §2.6](02-solution-design.md#26-ai-assistance-in-the-design-phase) |
| 2-3 sample inputs with expected "good output" | [03](03-testing-approach.md) |
| Manual verification | [03 §4](03-testing-approach.md#4-manual-verification-procedure) |
| Working code | `backend/`, `extension/`, `webview-ui/` |
| README with setup instructions | [../README.md](../README.md) |
| At least one AI integration | [04 §3](04-implementation.md#3-ai-integration) |
| Logging and visible process output | [04 §4](04-implementation.md#4-logging-and-process-visibility) |
| Key decisions explained | [04 §5](04-implementation.md#5-key-design-decisions) |
| Summary, prompt examples, testing, reflection | [05](05-summary-and-reflection.md) |
