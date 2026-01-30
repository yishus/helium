interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-opus-4-20250514": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
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
