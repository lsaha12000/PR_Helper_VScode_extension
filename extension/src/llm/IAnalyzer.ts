export interface WorkItemStory {
  id: number;
  title: string;
  description: string;
  type: string;
  acceptance_criteria: string;
}

export interface StoryAnalysis {
  storyId: number;
  status: "PASS" | "PARTIAL" | "FAIL";
  evidence: string;
  gaps: string;
}

export interface IAnalyzer {
  analyze(diff: string, stories: WorkItemStory[]): Promise<StoryAnalysis[]>;
}
