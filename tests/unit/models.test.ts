import { describe, it, expect } from '@jest/globals';
import { createMockAdapter } from '../../src/models/mock.js';
import { parseModelIdentifier, estimateCost } from '../../src/models/interface.js';

describe('Mock Model Adapter', () => {
  it('should return mock response', async () => {
    const adapter = createMockAdapter({ response: 'Hello, world!' });
    const response = await adapter.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.content).toBe('Hello, world!');
    expect(response.usage.inputTokens).toBe(10);
    expect(response.usage.outputTokens).toBe(20);
  });

  it('should respect custom token counts', async () => {
    const adapter = createMockAdapter({
      response: 'Test',
      inputTokens: 100,
      outputTokens: 200
    });
    const response = await adapter.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.usage.inputTokens).toBe(100);
    expect(response.usage.outputTokens).toBe(200);
  });

  it('should throw error if configured', async () => {
    const adapter = createMockAdapter({ error: new Error('Test error') });

    await expect(adapter.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow('Test error');
  });

  it('should respect delay', async () => {
    const adapter = createMockAdapter({ delay: 100 });
    const start = Date.now();
    await adapter.chat([{ role: 'user', content: 'Hi' }]);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(90);
  });

  it('should stream response', async () => {
    const adapter = createMockAdapter({ response: 'Hello world test' });
    const chunks: string[] = [];

    for await (const chunk of adapter.chatStream!([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toContain('Hello');
  });
});

describe('parseModelIdentifier', () => {
  it('should parse full identifier', () => {
    const result = parseModelIdentifier('anthropic/claude-sonnet-4-6');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.variant).toBeUndefined();
  });

  it('should parse identifier with variant', () => {
    const result = parseModelIdentifier('ollama/llama3:70b');
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama3');
    expect(result.variant).toBe('70b');
  });

  it('should handle model-only identifier', () => {
    const result = parseModelIdentifier('gpt-4o');
    expect(result.provider).toBe('default');
    expect(result.model).toBe('gpt-4o');
  });
});

describe('estimateCost', () => {
  it('should estimate cost for Claude models', () => {
    const cost = estimateCost('anthropic/claude-sonnet-4-6', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });

  it('should estimate zero cost for Ollama models', () => {
    const cost = estimateCost('ollama/llama3.1', 1000, 500);
    expect(cost).toBe(0);
  });

  it('should return reasonable estimate for unknown models', () => {
    const cost = estimateCost('unknown/model', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });
});
