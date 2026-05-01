import { Agent } from './base.js';
import type { AgentInput, AgentOutput, AgentConfig, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';

const ANALYZER_SYSTEM_PROMPT = `You are an expert code analyzer. Your task is to analyze code and provide insights on:
- Code quality issues
- Potential bugs
- Security vulnerabilities
- Performance concerns
- Best practice violations

Provide a structured analysis with clear categorization.`;

const ANALYZER_USER_PROMPT_TEMPLATE = `Analyze the following code{focus_section}:

{code}

Provide your analysis in the following JSON format:
{
  "analysis": "Brief summary of findings",
  "metrics": {
    "complexity": "low|medium|high",
    "maintainability": "low|medium|high",
    "testCoverage": "estimated percentage"
  },
  "issues": [
    {
      "type": "bug|security|performance|style|best-practice",
      "severity": "low|medium|high|critical",
      "description": "Issue description",
      "location": "file:line if known",
      "suggestion": "How to fix"
    }
  ],
  "has_security_concern": true|false,
  "recommendations": ["list of improvement suggestions"]
}`;

export class AnalyzerAgent extends Agent {
  readonly config: AgentConfig = {
    id: 'analyzer',
    name: 'Code Analyzer',
    description: 'Analyzes code for quality, security, and performance issues',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        focus: { type: 'string', description: 'Focus areas (optional)' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        analysis: { type: 'string' },
        metrics: { type: 'object' },
        issues: { type: 'array' },
        has_security_concern: { type: 'boolean' },
        recommendations: { type: 'array' },
      },
    },
    defaultModel: 'anthropic/claude-sonnet-4-6',
  };

  async execute(input: AgentInput, _context: ExecutionContext): Promise<AgentOutput> {
    const code = input['code'];
    const focus = typeof input['focus'] === 'string' ? input['focus'] as string : '';

    if (!code || typeof code !== 'string') {
      return this.formatError('Input "code" is required and must be a string');
    }

    const focusSection = focus ? ` with focus on: ${focus}` : '';

    const userPrompt = ANALYZER_USER_PROMPT_TEMPLATE
      .replace('{focus_section}', focusSection)
      .replace('{code}', code);

    const modelId = this.config.defaultModel ?? 'anthropic/claude-sonnet-4-6';

    try {
      const response = await modelRegistry.chat(
        modelId,
        [
          { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]
      );

      // Parse JSON response
      let data: Record<string, unknown>;
      try {
        // Extract JSON from response (handle markdown code blocks)
        let content = response.content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          content = jsonMatch[1].trim();
        }
        data = JSON.parse(content);
      } catch {
        // If JSON parsing fails, wrap the content
        data = {
          analysis: response.content,
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
