import type { IAnalyzer, WorkItemStory, StoryAnalysis } from "./IAnalyzer";

export class OpenAIAnalyzer implements IAnalyzer {
  private readonly apiKey: string;
  private readonly backendPort: number;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(apiKey: string, backendPort: number, baseUrl = "https://api.openai.com/v1", model = "gpt-4o") {
    this.apiKey = apiKey;
    this.backendPort = backendPort;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async analyze(diff: string, stories: WorkItemStory[]): Promise<StoryAnalysis[]> {
    const response = await fetch(`http://127.0.0.1:${this.backendPort}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diff,
        stories,
        api_key: this.apiKey,
        base_url: this.baseUrl,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Analysis error ${response.status}: ${err}`);
    }

    return response.json() as Promise<StoryAnalysis[]>;
  }
}
