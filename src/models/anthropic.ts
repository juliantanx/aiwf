import Anthropic from '@anthropic-ai/sdk';
import type { ModelAdapter, ChatMessage, ModelConfig, ModelResponse, CreateModelOptions } from '../core/types.js';
import { DEFAULT_MODEL_CAPABILITIES, parseModelIdentifier } from './interface.js';

export function createAnthropicAdapter(options: CreateModelOptions = {}): ModelAdapter {
  const { apiKey } = options;
  let client: Anthropic | null = null;

  const getClient = (): Anthropic => {
    if (!client) {
      client = new Anthropic({
        apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
      });
    }
    return client;
  };

  return {
    id: 'anthropic',
    name: 'Anthropic',
    capabilities: {
      ...DEFAULT_MODEL_CAPABILITIES,
      functionCalling: true,
      vision: true,
    },

    async chat(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): Promise<ModelResponse> {
      const { model = 'claude-sonnet-4-6', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'claude-sonnet-4-6';

      // Separate system message from conversation
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const startTime = Date.now();

      const response = await getClient().messages.create({
        model: modelName,
        max_tokens: maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature,
        top_p: topP,
        stop_sequences: stopSequences,
      });

      const latency = Date.now() - startTime;

      // Extract text from content blocks
      let content = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: modelName,
        latency,
      };
    },

    async *chatStream(
      messages: ChatMessage[],
      config: ModelConfig = {}
    ): AsyncGenerator<string> {
      const { model = 'claude-sonnet-4-6', temperature, maxTokens, topP, stopSequences } = config;
      const parsed = parseModelIdentifier(model);
      const modelName = parsed.model || 'claude-sonnet-4-6';

      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const stream = getClient().messages.stream({
        model: modelName,
        max_tokens: maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature,
        top_p: topP,
        stop_sequences: stopSequences,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    },
  };
}
