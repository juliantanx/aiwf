import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const CODER_SYSTEM_PROMPT = `You are an expert software developer. Your role is to:
- Generate clean, well-structured code
- Follow best practices and common patterns
- Write self-documenting code with clear naming
- Include necessary error handling
- Provide explanations for complex logic

Always produce working, complete code unless asked otherwise.`;

const CODER_USER_PROMPT_TEMPLATE = `Generate code based on the following request:

{prompt}

{language_section}
{context_section}

Provide your response in the following JSON format:
{
  "code": "The generated code",
  "explanation": "Brief explanation of the approach",
  "dependencies": ["Required dependencies if any"],
  "usage_example": "Example of how to use this code"
}`;

export class CoderAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'coder',
    name: 'Code Generator',
    description: 'Generates code based on natural language descriptions',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Description of code to generate' },
        language: { type: 'string', description: 'Programming language' },
        context: { type: 'string', description: 'Additional context or requirements' },
      },
      required: ['prompt'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        explanation: { type: 'string' },
        dependencies: { type: 'array' },
        usage_example: { type: 'string' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, context: ExecutionContext): Promise<AgentOutput> {
    const prompt = input['prompt'];
    const language = input['language'] as string | undefined;
    const ctx = input['context'];

    if (!prompt || typeof prompt !== 'string') {
      return this.formatError('Input "prompt" is required and must be a string');
    }

    const languageSection = language ? `Language: ${language}` : '';
    const contextSection = ctx ? `\n\nContext/Requirements:\n${ctx}` : '';

    const userPrompt = CODER_USER_PROMPT_TEMPLATE
      .replace('{prompt}', prompt)
      .replace('{language_section}', languageSection)
      .replace('{context_section}', contextSection);

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: CODER_SYSTEM_PROMPT },
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
        // Try to extract code block
        const codeMatch = response.content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        data = {
          code: codeMatch?.[1] ?? response.content,
          explanation: '',
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
