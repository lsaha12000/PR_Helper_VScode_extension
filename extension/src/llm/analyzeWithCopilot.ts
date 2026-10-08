import * as vscode from "vscode";
import type { IAnalyzer, WorkItemStory, StoryAnalysis } from "./IAnalyzer";

export class CopilotAnalyzer implements IAnalyzer {
  async analyze(diff: string, stories: WorkItemStory[]): Promise<StoryAnalysis[]> {
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    if (!models.length) {
      throw new Error("No GitHub Copilot model available. Please sign in to Copilot.");
    }
    const model = models[0];

    const storiesText = stories
      .map(
        (s) =>
          `[ID:${s.id}] ${s.type}: ${s.title}\nDescription: ${s.description || "N/A"}\nAcceptance Criteria: ${s.acceptance_criteria || "N/A"}`
      )
      .join("\n\n");

    const systemPrompt = vscode.LanguageModelChatMessage.Assistant(
      `You are a senior code reviewer. You are given a git diff and a list of user stories with acceptance criteria.
Your task is to determine whether the code changes satisfy each user story.
Respond ONLY with a valid JSON array — no markdown, no explanation outside the JSON.
Each element must be: { "storyId": number, "status": "PASS"|"PARTIAL"|"FAIL", "evidence": "quote or reference from diff", "gaps": "what is missing or empty string if none" }`
    );

    const userPrompt = vscode.LanguageModelChatMessage.User(
      `## User Stories\n\n${storiesText}\n\n## Git Diff\n\`\`\`diff\n${diff.slice(0, 30_000)}\n\`\`\``
    );

    const response = await model.sendRequest(
      [systemPrompt, userPrompt],
      {},
      new vscode.CancellationTokenSource().token
    );

    let raw = "";
    for await (const chunk of response.text) {
      raw += chunk;
    }

    const json = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(json) as StoryAnalysis[];
  }
}
