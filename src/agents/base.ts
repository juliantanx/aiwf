import type {
  AgentInput,
  AgentOutput,
  AgentConfig,
  ExecutionContext,
} from '../core/types.js';
import type { ModelAdapter } from '../models/interface.js';

export abstract class Agent {
  abstract readonly config: AgentConfig;

  abstract execute(
    input: AgentInput,
    context: ExecutionContext
  ): Promise<AgentOutput>;

  protected buildPrompt(
    systemPrompt: string,
    userPrompt: string,
    input: AgentInput
  ): { system: string; user: string } {
    // Replace placeholders in prompts
    let system = systemPrompt;
    let user = userPrompt;

    for (const [key, value] of Object.entries(input)) {
      const placeholder = `{${key}}`;
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      system = system.replace(new RegExp(placeholder, 'g'), strValue);
      user = user.replace(new RegExp(placeholder, 'g'), strValue);
    }

    return { system, user };
  }

  protected formatOutput(data: unknown): AgentOutput {
    return {
      success: true,
      data,
    };
  }

  protected formatError(error: string): AgentOutput {
    return {
      success: false,
      data: null,
      error,
    };
  }
}

export interface AgentConstructor {
  new (): Agent;
}
