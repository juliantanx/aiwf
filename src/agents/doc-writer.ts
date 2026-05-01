import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const DOC_WRITER_SYSTEM_PROMPT = `You are an expert technical writer. Your role is to:
- Create clear, comprehensive documentation
- Explain complex concepts in simple terms
- Include practical examples
- Structure documentation logically
- Cover all important aspects (purpose, usage, parameters, examples)`;

const DOC_WRITER_USER_PROMPT_TEMPLATE = `Generate documentation for the following code:

{code}

{format_section}

Provide your response in the following JSON format:
{
  "documentation": "The generated documentation",
  "format": "markdown|html|plain",
  "sections": ["Overview", "Usage", "Parameters", "Examples", "Notes"],
  "examples": ["Example code snippets if applicable"]
}`;

export class DocWriterAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'doc-writer',
    name: 'Documentation Writer',
    description: 'Generates documentation for code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to document' },
        format: { type: 'string', description: 'Output format: markdown, html, plain' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        documentation: { type: 'string' },
        format: { type: 'string' },
        sections: { type: 'array' },
        examples: { type: 'array' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, _context: ExecutionContext): Promise<AgentOutput> {
    const code = input['code'];
    const format = (input['format'] as string) ?? 'markdown';

    if (!code || typeof code !== 'string') {
      return this.formatError('Input "code" is required and must be a string');
    }

    const formatSection = `Format: ${format}`;

    const userPrompt = DOC_WRITER_USER_PROMPT_TEMPLATE
      .replace('{code}', code)
      .replace('{format_section}', formatSection);

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: DOC_WRITER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]
      );

      let data: Record<string, unknown>;
      try {
        let content = response.content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          content = jsonMatch[1].trim();
        }
        data = JSON.parse(content);
      } catch {
        data = {
          documentation: response.content,
          format,
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
