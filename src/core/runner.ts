import type {
  Workflow,
  WorkflowStep,
  ExecutionContext,
  RunRecord,
  RunStepRecord,
  AgentOutput,
  RunResult,
  GitContext,
} from './types.js';
import { VariableResolver, createResolver, generateRunId } from './resolver.js';
import { agentRegistry } from '../agents/registry.js';
import { modelRegistry } from '../models/registry.js';
import { estimateCost } from '../models/interface.js';
import { getGitContext } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { withRetry, getErrorType } from '../utils/retry.js';
import { saveRun, saveRunOutput, getRunsPath } from '../storage/run.js';
import { getAiwfPath } from '../storage/config.js';

export interface RunnerOptions {
  dryRun?: boolean;
  verbose?: boolean;
  noSave?: boolean;
  inputs?: Record<string, unknown>;
  modelOverride?: string;
}

export class WorkflowRunner {
  private projectRoot: string;
  private resolver: VariableResolver;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.resolver = createResolver();
  }

  async execute(workflow: Workflow, options: RunnerOptions = {}): Promise<RunResult> {
    const runId = generateRunId();
    const startTime = new Date();

    logger.setVerbose(options.verbose ?? false);

    // Initialize context
    const gitContext = await getGitContext(this.projectRoot);

    const context: ExecutionContext = {
      runId,
      workflowName: workflow.name,
      workflowVersion: workflow.version,
      inputs: options.inputs ?? {},
      env: { ...process.env as Record<string, string>, ...workflow.env },
      steps: {},
      git: gitContext,
      timestamp: startTime,
    };

    // Set up resolver context
    this.resolver = createResolver({
      inputs: context.inputs,
      env: context.env,
      git: context.git,
      run: {
        id: runId,
        timestamp: startTime.toISOString(),
      },
    });

    // Initialize run record
    const runRecord: RunRecord = {
      id: runId,
      workflow: workflow.name,
      version: workflow.version,
      status: 'running',
      trigger: 'manual',
      timestamp: {
        start: startTime,
      },
      git: gitContext.branch ? {
        branch: gitContext.branch,
        commit: gitContext.commit,
        author: gitContext.author,
      } : undefined,
      input: context.inputs,
      steps: [],
    };

    // Validate inputs
    const inputErrors = this.validateInputs(workflow, context.inputs);
    if (inputErrors.length > 0) {
      runRecord.status = 'failed';
      runRecord.error = `Input validation failed: ${inputErrors.join(', ')}`;
      runRecord.timestamp.end = new Date();
      await this.saveRunRecord(runRecord, options.noSave);
      return {
        success: false,
        runId,
        workflow: workflow.name,
        error: runRecord.error,
      };
    }

    // Execute steps
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let hasError = false;

    for (const step of workflow.steps) {
      logger.startSpinner(`Executing step: ${step.id}`);

      const stepRecord: RunStepRecord = {
        id: step.id,
        status: 'running',
        startTime: new Date(),
      };

      try {
        // Check condition
        if (step.condition) {
          const shouldRun = this.resolver.evaluateCondition(step.condition);
          if (!shouldRun) {
            logger.stopSpinner(true, `Skipped: ${step.id}`);
            stepRecord.status = 'skipped';
            stepRecord.endTime = new Date();
            runRecord.steps.push(stepRecord);
            continue;
          }
        }

        if (options.dryRun) {
          logger.stopSpinner(true, `[Dry run] ${step.id}`);
          stepRecord.status = 'success';
          stepRecord.endTime = new Date();
          runRecord.steps.push(stepRecord);
          continue;
        }

        // Resolve inputs
        const resolvedInput = this.resolver.resolve(step.input);

        // Execute step with retry
        const output = await this.executeStep(
          step,
          resolvedInput,
          context,
          workflow.model,
          options.modelOverride
        );

        // Update context with step output
        context.steps[step.id] = { output };
        this.resolver.setContext({ steps: context.steps });

        stepRecord.status = output.success ? 'success' : 'failed';
        stepRecord.endTime = new Date();
        stepRecord.duration = stepRecord.endTime.getTime() - (stepRecord.startTime?.getTime() ?? 0);
        stepRecord.model = step.model ?? workflow.model ?? modelRegistry.getDefaultModel();
        stepRecord.tokens = output.tokens;

        if (output.tokens) {
          totalInputTokens += output.tokens.input;
          totalOutputTokens += output.tokens.output;
        }

        if (!output.success && !step.continueOnError) {
          hasError = true;
          stepRecord.error = output.error;
          logger.stopSpinner(false, `Failed: ${step.id}`);
        } else {
          logger.stopSpinner(true, `Completed: ${step.id}`);
        }

        if (!output.success && step.continueOnError) {
          logger.warn(`Step ${step.id} failed but continuing (continueOnError: true)`);
        }
      } catch (error) {
        hasError = true;
        stepRecord.status = 'failed';
        stepRecord.endTime = new Date();
        stepRecord.error = error instanceof Error ? error.message : 'Unknown error';
        logger.stopSpinner(false, `Error: ${step.id}`);
      }

      runRecord.steps.push(stepRecord);

      if (hasError && !step.continueOnError) {
        break;
      }
    }

    // Finalize run record
    const endTime = new Date();
    runRecord.status = hasError ? 'failed' : 'success';
    runRecord.timestamp.end = endTime;
    runRecord.timestamp.duration = endTime.getTime() - startTime.getTime();

    const defaultModel = workflow.model ?? modelRegistry.getDefaultModel();
    runRecord.totals = {
      duration: runRecord.timestamp.duration,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      estimatedCost: estimateCost(defaultModel, totalInputTokens, totalOutputTokens),
    };

    // Save run record
    await this.saveRunRecord(runRecord, options.noSave);

    // Generate output
    let output: unknown = null;
    if (!hasError && workflow.output) {
      output = this.resolver.resolve(workflow.output);
      if (!options.noSave) {
        const format = workflow.output.format ?? 'json';
        await saveRunOutput(this.projectRoot, workflow.name, runId, output, format);
      }
    }

    return {
      success: !hasError,
      runId,
      workflow: workflow.name,
      output,
      totals: runRecord.totals,
    };
  }

  private async executeStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    context: ExecutionContext,
    defaultModel?: string,
    modelOverride?: string
  ): Promise<AgentOutput> {
    const agent = agentRegistry.get(step.agent);
    if (!agent) {
      return {
        success: false,
        data: null,
        error: `Unknown agent: ${step.agent}`,
      };
    }

    const modelId = modelOverride ?? step.model ?? defaultModel ?? modelRegistry.getDefaultModel();

    // Set model for agent if it supports it
    const agentConfig = agent.config;
    if (agentConfig.defaultModel !== modelId) {
      // Clone agent with different model (simplified approach)
    }

    // Execute with retry
    const retryConfig = step.retry ?? {};

    return withRetry(
      async () => {
        return agent.execute(input, context);
      },
      {
        maxAttempts: retryConfig.maxAttempts ?? 1,
        backoff: retryConfig.backoff ?? 'exponential',
        initialDelay: retryConfig.initialDelay ?? 1000,
        maxDelay: retryConfig.maxDelay ?? 30000,
        retryOn: ['rate_limit', 'timeout', 'server_error'],
      },
      (ctx) => {
        logger.debug(`Retry ${ctx.attempt}/${ctx.maxAttempts} after ${ctx.delay}ms`);
      }
    );
  }

  private validateInputs(workflow: Workflow, inputs: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!workflow.inputs) return errors;

    for (const [name, def] of Object.entries(workflow.inputs)) {
      if (def.required && inputs[name] === undefined && def.default === undefined) {
        errors.push(`Missing required input: ${name}`);
      }
    }

    return errors;
  }

  private async saveRunRecord(runRecord: RunRecord, noSave?: boolean): Promise<void> {
    if (noSave) return;

    try {
      await saveRun(this.projectRoot, runRecord);
    } catch (error) {
      logger.warn('Failed to save run record:', error);
    }
  }
}

export async function runWorkflow(
  projectRoot: string,
  workflow: Workflow,
  options?: RunnerOptions
): Promise<RunResult> {
  const runner = new WorkflowRunner(projectRoot);
  return runner.execute(workflow, options);
}
