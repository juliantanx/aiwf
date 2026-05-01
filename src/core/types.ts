// Core type definitions for AI Workflow CLI

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowTrigger {
  type: 'manual' | 'pull_request' | 'push' | 'schedule' | 'webhook';
  config?: Record<string, unknown>;
}

export interface InputDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface StepCondition {
  expression: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoff: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  retryOn: string[];
}

export interface WorkflowStep {
  id: string;
  agent: string;
  model?: string;
  input: Record<string, unknown>;
  condition?: string;
  retry?: Partial<RetryConfig>;
  continueOnError?: boolean;
  timeout?: number;
}

export interface OutputDefinition {
  format: 'json' | 'markdown' | 'text';
  path?: string;
  [key: string]: unknown;
}

export interface Workflow {
  apiVersion: string;
  kind: 'Workflow';
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  triggers?: WorkflowTrigger[];
  inputs?: Record<string, InputDefinition>;
  env?: Record<string, string>;
  model?: string;
  steps: WorkflowStep[];
  output?: OutputDefinition;
  retry?: Partial<RetryConfig>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentInput {
  [key: string]: unknown;
}

export interface AgentOutput {
  success: boolean;
  data: unknown;
  error?: string;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  defaultModel?: string;
  systemPrompt?: string;
}

export interface ExecutionContext {
  runId: string;
  workflowName: string;
  workflowVersion: string;
  inputs: Record<string, unknown>;
  env: Record<string, string>;
  steps: Record<string, { output: AgentOutput }>;
  git: GitContext;
  timestamp: Date;
}

export interface GitContext {
  branch: string;
  commit: string;
  author?: string;
  message?: string;
  remote?: string;
}

// ============================================================================
// Model Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface ModelResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  latency: number;
}

export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
}

export interface ModelAdapter {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  chat(messages: ChatMessage[], config?: ModelConfig): Promise<ModelResponse>;
  chatStream?(messages: ChatMessage[], config?: ModelConfig): AsyncGenerator<string>;
}

export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  organization?: string;
  headers?: Record<string, string>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface RunStepRecord {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  model?: string;
  tokens?: { input: number; output: number };
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface RunRecord {
  id: string;
  workflow: string;
  version: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  trigger: 'manual' | 'hook' | 'ci' | 'schedule';
  timestamp: {
    start: Date;
    end?: Date;
    duration?: number;
  };
  git?: {
    branch: string;
    commit: string;
    author?: string;
  };
  input: Record<string, unknown>;
  steps: RunStepRecord[];
  totals?: {
    duration: number;
    tokens: { input: number; output: number };
    estimatedCost: number;
  };
  error?: string;
}

export interface AiwfConfig {
  models: {
    default?: string;
    providers: Record<string, ProviderConfig>;
  };
  hooks?: Record<string, Array<{ workflow: string; failFast?: boolean; branches?: string[] }>>;
  fallback?: {
    enabled: boolean;
    modelChain: string[];
    trigger: Array<{ errorType: string; count?: number }>;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorType =
  | 'config_error'
  | 'input_error'
  | 'model_error'
  | 'network_error'
  | 'execution_error'
  | 'system_error'
  | 'rate_limit'
  | 'timeout'
  | 'server_error'
  | 'invalid_api_key'
  | 'model_not_found';

export class AiwfError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AiwfError';
  }
}

// ============================================================================
// Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

export interface RunResult {
  success: boolean;
  runId: string;
  workflow: string;
  output?: unknown;
  report?: string;
  totals?: {
    duration: number;
    tokens: { input: number; output: number };
    estimatedCost: number;
  };
  error?: string;
}
