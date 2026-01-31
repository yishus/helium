interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-opus-4-20250514": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "gemini-3-flash-preview": {
    inputPerMillion: 0.5,
    outputPerMillion: 3,
  },
  "gemini-3-pro-preview": {
    inputPerMillion: 2,
    outputPerMillion: 12,
  },
  "gemini-2.5-pro": {
    inputPerMillion: 1.25,
    outputPerMillion: 10,
  },
  "gpt-5.2-codex": {
    inputPerMillion: 1.75,
    outputPerMillion: 14,
  },
  "gpt-5.1-codex-mini": {
    inputPerMillion: 0.25,
    outputPerMillion: 2,
  },
};

export interface TokenCost {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export namespace TokenCostHelper {
  export const calculateCost = (
    inputTokens: number,
    outputTokens: number,
    model: string = "claude-sonnet-4-5-20250929",
  ): TokenCost => {
    const pricing = MODEL_PRICING[model];

    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  };

  export const formatCost = (cost: number): string => {
    return `$${cost.toFixed(6)}`;
  };

  export const getSupportedModels = (): string[] => {
    return Object.keys(MODEL_PRICING);
  };

  export const getModelPricing = (model: string): ModelPricing | undefined => {
    return MODEL_PRICING[model];
  };
}
