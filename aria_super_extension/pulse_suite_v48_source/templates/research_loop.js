// [ARIA] V40 OMNIPOTENCE - Research Loop Template
export const ResearchLoop = {
  name: "Autonomous Deep Research",
  steps: [
    "Initial data harvest",
    "Identify knowledge gaps",
    "Deepen research on gaps",
    "Synthesize final report"
  ],
  generatePrompt: (goal, step) => {
    return `Step ${step}: Researching ${goal}...`;
  }
};
