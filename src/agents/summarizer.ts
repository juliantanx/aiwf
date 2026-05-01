import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const SUMMARIZER_SYSTEM_PROMPT = `You are an expert at summarizing content. Your role is to:
- Create concise, accurate summaries
- Preserve key information and context
- Structure summaries logically
- Adjust detail level based on requirements`;

const SUMMARIZER_USER_PROMPT_TEMPLATE = `Summarize the following content:

{content}

{max_length_section}

Provide your response in the following JSON format:
{
  "summary": "The summary",
  "key_points": ["Main point 1", "Main point 2"],
  "word_count": "Number of words in summary"
}`;

export class SummarizerAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'summarizer',
    name: 'Content Summarizer',
    description: 'Summarizes content while preserving key information',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to summarize' },
        max_length: { type: 'number', description: 'Maximum length in words' },
      },
      required: ['content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        key_points: { type: 'array' },
        word_count: { type: 'number' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, _context: ExecutionContext): Promise<AgentOutput> {
    const content = input['content'];
    const maxLength = input['max_length'];

    if (!content || typeof content !== 'string') {
      return this.formatError('Input "content" is required and must be a string');
    }

    const maxLengthSection = maxLength ? `Maximum length: ${maxLength} words` : '';

    const userPrompt = SUMMARIZER_USER_PROMPT_TEMPLATE
      .replace('{content}', content)
      .replace('{max_length_section}', maxLengthSection);

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]
      );

      let data: Record<string, unknown>;
      try {
        let respContent = response.content;
        const jsonMatch = respContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          respContent = jsonMatch[1].trim();
        }
        data = JSON.parse(respContent);
      } catch {
        data = {
          summary: response.content,
          raw: true,
        };
      }

      return {
        success: true,
        data,
        tokens: {
          input: response.usage.inputTokens,
          output: response.usage.outputTokens,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.formatError(`Model execution failed: ${message}`);
    }
  }
}
