import { Type, type Static } from "typebox";

import type { Tool, ToolConfig } from "./";

const optionSchema = Type.Object({
  label: Type.String({
    description:
      "The display text for this option that the user will see and select. Should be concise (1-5 words).",
  }),
  description: Type.String({
    description:
      "Explanation of what this option means or what will happen if chosen.",
  }),
});

const questionSchema = Type.Object({
  question: Type.String({
    description:
      "The complete question to ask the user. Should be clear, specific, and end with a question mark.",
  }),
  header: Type.String({
    description:
      "Very short label displayed as a chip/tag (max 12 chars). Examples: 'Auth method', 'Library', 'Approach'.",
  }),
  options: Type.Array(optionSchema, {
    description:
      "The available choices for this question. Must have 2-4 options.",
    minItems: 2,
    maxItems: 4,
  }),
  multiSelect: Type.Boolean({
    description:
      "Set to true to allow the user to select multiple options instead of just one.",
    default: false,
  }),
});

const askUserQuestionSchema = Type.Object({
  questions: Type.Array(questionSchema, {
    description: "Questions to ask the user (1-4 questions)",
    minItems: 1,
    maxItems: 4,
  }),
});

export type AskUserQuestionInput = Static<typeof askUserQuestionSchema>;
export type QuestionInput = Static<typeof questionSchema>;
export type OptionInput = Static<typeof optionSchema>;

const definition = {
  name: "askUserQuestion",
  description:
    "Ask the user questions to gather preferences, clarify ambiguous instructions, get decisions on implementation choices, or offer choices about what direction to take. Each question can have 2-4 options, and users can always provide custom text input via 'Other'.",
  input_schema: askUserQuestionSchema,
};

// The actual call function returns the user's answers, which are injected
// by the agent after the UI collects them
const callFunction = async (_args: AskUserQuestionInput, _config: ToolConfig): Promise<string> => {
  // This should never be called directly - the agent intercepts this tool
  // and handles it via the askUserQuestionHandler
  return "Error: ask_user_question should be handled by the agent, not called directly.";
};

export default { definition, callFunction } as Tool<
  typeof askUserQuestionSchema
>;
