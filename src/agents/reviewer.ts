import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const REVIEWER_SYSTEM_PROMPT = `You are an expert code reviewer. Your role is to review code and provide:
- Clear, actionable feedback
- Severity-based issue categorization
- Specific improvement suggestions
- Code examples when helpful

Be constructive and focus on meaningful issues, not nitpicks.`;

const REVIEWER_USER_PROMPT = `Review the following code${InputHasKey('type', ' focusing on {type} aspects')}:

{code}

Provide your review in the following JSON format:
{
  "summary": "Brief summary of the review",
  "comments": [
    {
      "file": "filename if known",
      "line": "line number if known",
      "severity": "low|medium|high|critical",
      "type": "bug|security|performance|style|best-practice|suggestion",
      "message": "Issue description",
      "suggestion": "How to fix or improve"
    }
  ],
  "positive_aspects": ["What's done well"],
  "overall_rating": "1-10",
  "recommendations": ["General recommendations"]
}`;

function InputHasKey(key: string, template: string): string {
  return template;
}

export class ReviewerAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code and provides actionable feedback',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to review' },
        type: { type: 'string', description: 'Review focus: security, performance, style, general' },
        analysis: { type: 'object', description: 'Previous analysis results (optional)' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        comments: { type: 'array' },
        positive_aspects: { type: 'array' },
        overall_rating: { type: 'number' },
        recommendations: { type: 'array' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, context: ExecutionContext): Promise<AgentOutput> {
    const code = input['code'];
    const type = input['type'] as string | undefined;
    const analysis = input['analysis'];

    if (!code || typeof code !== 'string') {
      return this.formatError('Input "code" is required and must be a string');
    }

    let userPrompt = REVIEWER_USER_PROMPT;

    if (type) {
      userPrompt = userPrompt.replace(
        '${InputHasKey(\'type\', \' focusing on {type} aspects\')}',
        ` focusing on ${type} aspects`
      );
    } else {
      userPrompt = userPrompt.replace(
        '${InputHasKey(\'type\', \' focusing on {type} aspects\')}',
        ''
      );
    }

    // Include previous analysis if provided
    let fullPrompt = userPrompt.replace('{code}', code).replace('{type}', type ?? '');
    if (analysis) {
      fullPrompt += `\n\nConsider this previous analysis:\n${JSON.stringify(analysis, null, 2)}`;
    }

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
          { role: 'user', content: fullPrompt },
        ]
      );

      // Parse JSON response
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
