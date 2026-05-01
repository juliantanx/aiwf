import type { GitContext } from './types.js';
import { randomUUID } from 'crypto';

// Variable syntax: ${{ source.path.to.value }}
const VARIABLE_PATTERN = /\$\{\{\s*([^}]+)\s*\}\}/g;

export interface ResolverContext {
  inputs?: Record<string, unknown>;
  env?: Record<string, string>;
  steps?: Record<string, { output: unknown }>;
  run?: {
    id: string;
    timestamp: string;
  };
  git?: GitContext;
}

export class VariableResolver {
  private context: ResolverContext;

  constructor(context: ResolverContext = {}) {
    this.context = context;
  }

  setContext(context: Partial<ResolverContext>): void {
    this.context = { ...this.context, ...context };
  }

  resolve(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.resolveString(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.resolve(item));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        resolved[key] = this.resolve(val);
      }
      return resolved;
    }

    return value;
  }

  private resolveString(value: string): string {
    return value.replace(VARIABLE_PATTERN, (_, expression: string) => {
      const result = this.evaluateExpression(expression.trim());
      return result !== undefined ? String(result) : '';
    });
  }

  private evaluateExpression(expression: string): unknown {
    // Handle nested paths like inputs.diff or steps.analyze.output.result
    const parts = expression.split('.');
    const root = parts[0];

    let current: unknown;

    switch (root) {
      case 'inputs':
        current = this.context.inputs;
        break;
      case 'env':
        current = this.context.env;
        break;
      case 'steps':
        current = this.context.steps;
        break;
      case 'run':
        current = this.context.run;
        break;
      case 'git':
        current = this.context.git;
        break;
      default:
        return undefined;
    }

    // Navigate the path
    for (let i = 1; i < parts.length && current !== undefined && current !== null; i++) {
      const part = parts[i];
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part!];
      } else {
        return undefined;
      }
    }

    return current;
  }

  resolveTemplate(template: string, data: Record<string, unknown>): string {
    // Simple template resolution with {{ variable }} syntax
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });
  }

  // Check if a condition expression evaluates to true
  evaluateCondition(condition: string): boolean {
    // Resolve any variables in the condition
    const resolved = this.resolveString(condition);

    // Simple truthy evaluation
    if (resolved === 'true' || resolved === '1') return true;
    if (resolved === 'false' || resolved === '0' || resolved === '') return false;

    // If it's a truthy value
    return Boolean(resolved);
  }
}

export function createResolver(context: Partial<ResolverContext> = {}): VariableResolver {
  const runContext: ResolverContext = {
    inputs: context.inputs ?? {},
    env: context.env ?? {},
    steps: context.steps ?? {},
    run: context.run ?? {
      id: generateRunId(),
      timestamp: new Date().toISOString(),
    },
    git: context.git ?? {
      branch: '',
      commit: '',
    },
  };

  return new VariableResolver(runContext);
}

export function generateRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}
