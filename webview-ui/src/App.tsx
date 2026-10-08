import React, { useState } from "react";
import Step1Repo from "./steps/Step1Repo";
import Step2Branches from "./steps/Step2Branches";
import Step3Commits from "./steps/Step3Commits";
import Step4AIProvider from "./steps/Step4AIProvider";
import Step5AdoConfig from "./steps/Step5AdoConfig";
import Step6UserStories from "./steps/Step6UserStories";
import Step7Analysis from "./steps/Step7Analysis";
import Step8RaisePR from "./steps/Step8RaisePR";

export type AIProvider = "copilot" | "openai";

export interface ReviewerItem {
  id: string;
  displayName: string;
  uniqueName: string;
}

export interface WizardState {
  repoPath: string;
  fromBranch: string;
  toBranch: string;
  allBranches: string[];
  selectedCommits: string[];   // empty = all
  aiProvider: AIProvider;
  aiApiKey: string;            // OpenAI key (empty for Copilot)
  aiBaseUrl: string;           // custom base URL, default openai
  aiModel: string;             // model override, e.g. gpt-4o
  adoOrgUrl: string;
  adoPat: string;
  adoProject: string;
  adoRepoName: string;
  selectedStories: StoryItem[];
  diff: string;
  analysisResult: AnalysisItem[];
  // PR fields
  prReviewers: ReviewerItem[];
  prLabels: string[];
  prIsDraft: boolean;
  prComment: string;
}

export interface StoryItem {
  id: number;
  title: string;
  description: string;
  type: string;
  acceptance_criteria: string;
}

export interface AnalysisItem {
  storyId: number;
  status: "PASS" | "PARTIAL" | "FAIL";
  evidence: string;
  gaps: string;
}

const STEP_LABELS = ["Repo", "Branches", "Commits", "AI Provider", "ADO Config", "User Stories", "Analysis", "Raise PR"];

export default function App() {
  const [step, setStep] = useState(0);
  const INITIAL_STATE: WizardState = {
    repoPath: "",
    fromBranch: "",
    toBranch: "",
    allBranches: [],
    selectedCommits: [],
    aiProvider: "copilot",
    aiApiKey: "",
    aiBaseUrl: "https://api.openai.com/v1",
    aiModel: "gpt-4o",
    adoOrgUrl: "",
    adoPat: "",
    adoProject: "",
    adoRepoName: "",
    selectedStories: [],
    diff: "",
    analysisResult: [],
    prReviewers: [],
    prLabels: [],
    prIsDraft: false,
    prComment: "",
  };

  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const next = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const patch = (partial: Partial<WizardState>) => setState((s) => ({ ...s, ...partial }));
  const cancel = () => { setState(INITIAL_STATE); setStep(0); };

  return (
    <div className="wizard">
      {/* Progress dots */}
      <div className="progress-bar">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`step-dot ${i === step ? "active" : i < step ? "done" : ""}`}
            title={label}
          />
        ))}
      </div>

      {/* Current step */}
      {step === 0 && <Step1Repo state={state} patch={patch} next={next} />}
      {step === 1 && <Step2Branches state={state} patch={patch} next={next} back={back} />}
      {step === 2 && <Step3Commits state={state} patch={patch} next={next} back={back} />}
      {step === 3 && <Step4AIProvider state={state} patch={patch} next={next} back={back} />}
      {step === 4 && <Step5AdoConfig state={state} patch={patch} next={next} back={back} />}
      {step === 5 && <Step6UserStories state={state} patch={patch} next={next} back={back} />}
      {step === 6 && <Step7Analysis state={state} patch={patch} next={next} back={back} cancel={cancel} />}
      {step === 7 && <Step8RaisePR state={state} patch={patch} back={back} cancel={cancel} />}
    </div>
  );
}
