import ollama from 'ollama';
import type { ModelAdapter, ChatMessage, ModelConfig, ModelResponse, CreateModelOptions } from '../core/types.js';
import { DEFAULT_MODEL_CAPABILITIES, parseModelIdentifier } from './interface.js';

export function createOllamaAdapter(options: CreateModelOptions = {}): ModelAdapter {
  const { endpoint } = options;

  // Configure Ollama client if custom endpoint
  if (endpoint) {
    process.env['OLLAMA_HOST'] = endpoint;
  }

  return {
    id: 'ollama',
    name: 'Ollama',
    capabilities: {
      ...DEFAULT_MODEL_CAPABILITIES,
      functionCalling: false,
      vision: false,
    },

    async chat(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): Promise<ModelResponse> {
      const { model = 'llama3.1', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'llama3.1';

      const startTime = Date.now();

      const response = await ollama.chat({
        model: modelName,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        options: {
          temperature,
          num_predict: maxTokens,
          top_p: topP,
          stop: stopSequences,
        },
      });

      const latency = Date.now() - startTime;

      return {
        content: response.message.content,
        usage: {
          inputTokens: response.prompt_eval_count ?? 0,
          outputTokens: response.eval_count ?? 0,
        },
        model: modelName,
        latency,
      };
    },

    async *chatStream(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): AsyncGenerator<string> {
      const { model = 'llama3.1', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'llama3.1';

      const stream = await ollama.chat({
        model: modelName,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens,
          top_p: topP,
          stop: stopSequences,
        },
      });

      for await (const chunk of stream) {
        if (chunk.message.content) {
          yield chunk.message.content;
        }
      }
    },
  };
}
