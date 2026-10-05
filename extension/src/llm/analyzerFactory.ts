import type { IAnalyzer } from "./IAnalyzer";
import { CopilotAnalyzer } from "./analyzeWithCopilot";
import { OpenAIAnalyzer } from "./OpenAIAnalyzer";

export type ProviderConfig =
  | { provider: "copilot" }
  | { provider: "openai"; apiKey: string; baseUrl?: string; model?: string; backendPort: number };

export function createAnalyzer(config: ProviderConfig): IAnalyzer {
  if (config.provider === "openai") {
    return new OpenAIAnalyzer(config.apiKey, config.backendPort, config.baseUrl, config.model);
  }
  return new CopilotAnalyzer();
}
