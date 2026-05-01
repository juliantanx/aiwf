import OpenAI from 'openai';
import type { ModelAdapter, ChatMessage, ModelConfig, ModelResponse, CreateModelOptions } from '../core/types.js';
import { DEFAULT_MODEL_CAPABILITIES, parseModelIdentifier } from './interface.js';

export function createOpenAIAdapter(options: CreateModelOptions = {}): ModelAdapter {
  const { apiKey, organization } = options;
  let client: OpenAI | null = null;

  const getClient = (): OpenAI => {
    if (!client) {
      client = new OpenAI({
        apiKey: apiKey ?? process.env['OPENAI_API_KEY'],
        organization,
      });
    }
    return client;
  };

  return {
    id: 'openai',
    name: 'OpenAI',
    capabilities: {
      ...DEFAULT_MODEL_CAPABILITIES,
      functionCalling: true,
      vision: true,
    },

    async chat(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): Promise<ModelResponse> {
      const { model = 'gpt-4o', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'gpt-4o';

      const startTime = Date.now();

      const response = await getClient().chat.completions.create({
        model: modelName,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stop: stopSequences,
      });

      const latency = Date.now() - startTime;
      const choice = response.choices[0];

      if (!choice?.message?.content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        content: choice.message.content,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        model: modelName,
        latency,
      };
    },

    async *chatStream(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): AsyncGenerator<string> {
      const { model = 'gpt-4o', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'gpt-4o';

      const stream = await getClient().chat.completions.create({
        model: modelName,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stop: stopSequences,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    },
  };
}
