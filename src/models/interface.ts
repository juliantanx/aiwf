import type { ModelAdapter, ModelCapabilities, ChatMessage, ModelConfig, ModelResponse, CreateModelOptions } from '../core/types.js';

export type { ModelAdapter, ChatMessage, ModelConfig, ModelResponse, CreateModelOptions };

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  functionCalling: false,
  vision: false,
};

export function parseModelIdentifier(modelId: string): {
  provider: string;
  model: string;
  variant?: string;
} {
  const parts = modelId.split('/');
  if (parts.length === 1) {
    // No provider specified, assume it's a model name
    return { provider: 'default', model: parts[0] ?? '' };
  }

  const provider = parts[0]!;
  const modelParts = (parts[1] ?? '').split(':');
  const variant = modelParts[1];

  const result: {
    provider: string;
    model: string;
    variant?: string;
  } = {
    provider,
    model: modelParts[0] ?? '',
  };

  if (variant) {
    result.variant = variant;
  }

  return result;
}

export function getModelPricing(modelId: string): {
  inputPerToken: number;
  outputPerToken: number;
} {
  const { model } = parseModelIdentifier(modelId);
  const modelLower = model.toLowerCase();

  // Pricing per 1M tokens (as of 2024, approximate values)
  const pricingTable: Record<string, { input: number; output: number }> = {
    // OpenAI
    'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
    'gpt-4-turbo': { input: 10 / 1_000_000, output: 30 / 1_000_000 },
    'gpt-4': { input: 30 / 1_000_000, output: 60 / 1_000_000 },
    'gpt-3.5-turbo': { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },

    // Anthropic
    'claude-sonnet-4-6': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    'claude-sonnet-4-5': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    'claude-opus-4-7': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    'claude-haiku-4-5': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
    'claude-3-5-sonnet': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    'claude-3-opus': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    'claude-3-haiku': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },

    // Ollama (local, no cost)
    'llama3': { input: 0, output: 0 },
    'llama3.1': { input: 0, output: 0 },
    'codellama': { input: 0, output: 0 },
    'mistral': { input: 0, output: 0 },
  };

  // Find best match
  for (const [key, pricing] of Object.entries(pricingTable)) {
    if (modelLower.includes(key.toLowerCase()) || key.toLowerCase().includes(modelLower)) {
      return {
        inputPerToken: pricing.input,
        outputPerToken: pricing.output,
      };
    }
  }

  // Default pricing (moderate)
  return {
    inputPerToken: 1 / 1_000_000,
    outputPerToken: 3 / 1_000_000,
  };
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(modelId);
  return inputTokens * pricing.inputPerToken + outputTokens * pricing.outputPerToken;
}
