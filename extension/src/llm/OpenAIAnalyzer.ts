import type { IAnalyzer, WorkItemStory, StoryAnalysis } from "./IAnalyzer";

const SYSTEM_PROMPT = `You are a senior code reviewer. You are given a git diff and a list of user stories with acceptance criteria.
Your task is to determine whether the code changes satisfy each user story.
Respond ONLY with a valid JSON array — no markdown, no explanation outside the JSON.
Each element must be: { "storyId": number, "status": "PASS"|"PARTIAL"|"FAIL", "evidence": "quote or reference from diff", "gaps": "what is missing or empty string if none" }`;

export class OpenAIAnalyzer implements IAnalyzer {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(apiKey: string, baseUrl = "https://api.openai.com/v1", model = "gpt-4o") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async analyze(diff: string, stories: WorkItemStory[]): Promise<StoryAnalysis[]> {
    const storiesText = stories
      .map(
        (s) =>
          `[ID:${s.id}] ${s.type}: ${s.title}\nDescription: ${s.description || "N/A"}\nAcceptance Criteria: ${s.acceptance_criteria || "N/A"}`
      )
      .join("\n\n");

    const userContent = `## User Stories\n\n${storiesText}\n\n## Git Diff\n\`\`\`diff\n${diff.slice(0, 30_000)}\n\`\`\``;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const raw = data.choices[0]?.message?.content ?? "[]";
    // response_format: json_object wraps the array — unwrap if needed
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.result ?? parsed.analyses ?? Object.values(parsed)[0]);
  }
}
