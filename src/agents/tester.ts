import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const TESTER_SYSTEM_PROMPT = `You are an expert test engineer. Your role is to:
- Generate comprehensive test suites
- Cover edge cases and error scenarios
- Follow testing best practices
- Write clear, maintainable tests
- Include both positive and negative test cases`;

const TESTER_USER_PROMPT_TEMPLATE = `Generate tests for the following code:

{code}

{framework_section}

Provide your response in the following JSON format:
{
  "tests": "The generated test code",
  "framework": "Testing framework used",
  "coverage_estimate": "Estimated coverage percentage",
  "test_cases": [
    {
      "description": "What this test covers",
      "type": "unit|integration|edge-case|error-case"
    }
  ],
  "setup_required": ["Any setup or dependencies needed"]
}`;

export class TesterAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'tester',
    name: 'Test Generator',
    description: 'Generates test cases and test suites for code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to generate tests for' },
        framework: { type: 'string', description: 'Testing framework (jest, pytest, etc.)' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        tests: { type: 'string' },
        framework: { type: 'string' },
        coverage_estimate: { type: 'string' },
        test_cases: { type: 'array' },
        setup_required: { type: 'array' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, _context: ExecutionContext): Promise<AgentOutput> {
    const code = input['code'];
    const framework = input['framework'] as string | undefined;

    if (!code || typeof code !== 'string') {
      return this.formatError('Input "code" is required and must be a string');
    }

    const frameworkSection = framework ? `Testing framework: ${framework}` : '';

    const userPrompt = TESTER_USER_PROMPT_TEMPLATE
      .replace('{code}', code)
      .replace('{framework_section}', frameworkSection);

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: TESTER_SYSTEM_PROMPT },
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
        const codeMatch = response.content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        data = {
          tests: codeMatch?.[1] ?? response.content,
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
