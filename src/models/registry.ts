import type { ModelAdapter, ProviderConfig, AiwfConfig, ModelConfig, ChatMessage, ModelResponse } from '../core/types.js';
import { createOpenAIAdapter } from './openai.js';
import { createAnthropicAdapter } from './anthropic.js';
import { createOllamaAdapter } from './ollama.js';
import { createMockAdapter } from './mock.js';
import { parseModelIdentifier } from './interface.js';

class ModelRegistry {
  private adapters: Map<string, ModelAdapter> = new Map();
  private providerConfigs: Record<string, ProviderConfig> = {};
  private defaultModel: string = 'anthropic/claude-sonnet-4-6';

  constructor() {
    // Register default adapters
    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters(): void {
    // These will be configured when setConfig is called
    this.adapters.set('openai', createOpenAIAdapter());
    this.adapters.set('anthropic', createAnthropicAdapter());
    this.adapters.set('ollama', createOllamaAdapter());
    this.adapters.set('mock', createMockAdapter());
  }

  register(id: string, adapter: ModelAdapter): void {
    this.adapters.set(id, adapter);
  }

  setConfig(config: AiwfConfig): void {
    if (config.models?.default) {
      this.defaultModel = config.models.default;
    }

    if (config.models?.providers) {
      this.providerConfigs = config.models.providers;

      // Recreate adapters with configured options
      for (const [provider, providerConfig] of Object.entries(config.models.providers)) {
        switch (provider) {
          case 'openai':
            this.adapters.set('openai', createOpenAIAdapter(providerConfig));
            break;
          case 'anthropic':
            this.adapters.set('anthropic', createAnthropicAdapter(providerConfig));
            break;
          case 'ollama':
            this.adapters.set('ollama', createOllamaAdapter(providerConfig));
            break;
        }
      }
    }
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  getAdapter(provider: string): ModelAdapter | undefined {
    return this.adapters.get(provider);
  }

  hasAdapter(provider: string): boolean {
    return this.adapters.has(provider);
  }

  listAdapters(): Array<{ id: string; name: string }> {
    return Array.from(this.adapters.entries()).map(([id, adapter]) => ({
      id,
      name: adapter.name,
    }));
  }

  async chat(
    modelId: string,
    messages: ChatMessage[],
    config?: ModelConfig
  ): Promise<ModelResponse> {
    const { provider, model } = parseModelIdentifier(modelId);

    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unknown model provider: ${provider}`);
    }

    return adapter.chat(messages, { ...config, model });
  }

  async *chatStream(
    modelId: string,
    messages: ChatMessage[],
    config?: ModelConfig
  ): AsyncGenerator<string> {
    const { provider, model } = parseModelIdentifier(modelId);

    const adapter = this.adapters.get(provider);
    if (!adapter?.chatStream) {
      // Fall back to non-streaming
      const response = await this.chat(modelId, messages, config);
      yield response.content;
      return;
    }

    yield* adapter.chatStream(messages, { ...config, model });
  }
}

export const modelRegistry = new ModelRegistry();
