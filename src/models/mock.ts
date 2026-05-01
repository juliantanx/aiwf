import type { ModelAdapter, ChatMessage, ModelConfig, ModelResponse } from '../core/types.js';
import { DEFAULT_MODEL_CAPABILITIES } from './interface.js';

export interface MockModelConfig {
  response?: string;
  delay?: number;
  error?: Error;
  inputTokens?: number;
  outputTokens?: number;
}

export function createMockAdapter(config: MockModelConfig = {}): ModelAdapter {
  const {
    response = 'This is a mock response.',
    delay = 0,
    error,
    inputTokens = 10,
    outputTokens = 20,
  } = config;

  return {
    id: 'mock',
    name: 'Mock Model',
    capabilities: DEFAULT_MODEL_CAPABILITIES,

    async chat(
      messages: ChatMessage[],
      modelConfig: ModelConfig = {}
    ): Promise<ModelResponse> {
      if (error) {
        throw error;
      }

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return {
        content: response,
        usage: {
          inputTokens,
          outputTokens,
        },
        model: modelConfig.model || 'mock-model',
        latency: delay,
      };
    },

    async *chatStream(
      messages: ChatMessage[],
      _modelConfig: ModelConfig = {}
    ): AsyncGenerator<string> {
      if (error) {
        throw error;
      }

      const words = response.split(' ');
      for (const word of words) {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay / words.length));
        }
        yield word + ' ';
      }
    },
  };
}
