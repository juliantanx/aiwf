import { Command } from 'commander';
import type { RunnerOptions } from '../core/runner.js';
import { runWorkflow } from '../core/runner.js';
import { loadWorkflow } from '../storage/workflow.js';
import { findProjectRoot, loadConfig } from '../storage/config.js';
import { modelRegistry } from '../models/registry.js';
import { logger } from '../utils/logger.js';
import { AiwfError } from '../core/types.js';

interface RunOptions {
  input?: string[];
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
  output?: string;
  format?: string;
  noSave?: boolean;
}

function parseInputs(inputArray: string[] = []): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  for (const item of inputArray) {
    const [key, ...valueParts] = item.split('=');
    if (key && valueParts.length > 0) {
      inputs[key] = valueParts.join('=');
    }
  }

  return inputs;
}

export async function runCommand(workflowName: string, options: RunOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  // Load config and configure model registry
  const config = await loadConfig(projectRoot);
  modelRegistry.setConfig(config);

  // Load workflow
  logger.startSpinner(`Loading workflow: ${workflowName}`);
  const workflow = await loadWorkflow(projectRoot, workflowName);

  if (!workflow) {
    logger.stopSpinner(false, `Workflow not found: ${workflowName}`);
    process.exit(1);
  }

  logger.stopSpinner(true, `Workflow loaded: ${workflow.name} v${workflow.version}`);

  // Parse inputs
  const inputs = parseInputs(options.input);

  // Check required inputs
  if (workflow.inputs) {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(workflow.inputs)) {
      if (def.required && inputs[name] === undefined && def.default === undefined) {
        missing.push(name);
      }
    }

    if (missing.length > 0) {
      logger.error(`Missing required inputs: ${missing.join(', ')}`);
      logger.raw('Provide inputs with --input name=value');
      process.exit(1);
    }
  }

  // Run workflow
  logger.newline();
  logger.info(`Running workflow: ${workflow.name}`);
  logger.newline();

  const runnerOptions: RunnerOptions = {
    inputs,
    dryRun: options.dryRun,
    verbose: options.verbose,
    noSave: options.noSave,
    modelOverride: options.model,
  };

  try {
    const result = await runWorkflow(projectRoot, workflow, runnerOptions);

    logger.newline();

    if (result.success) {
      logger.success(`Workflow completed successfully`);
      logger.raw(`  Run ID: ${result.runId}`);

      if (result.totals) {
        logger.raw(`  Duration: ${result.totals.duration}ms`);
        logger.raw(`  Tokens: ${result.totals.tokens.input} in, ${result.totals.tokens.output} out`);
        logger.raw(`  Estimated cost: $${result.totals.estimatedCost.toFixed(4)}`);
      }

      if (result.output) {
        logger.newline();
        logger.raw('Output:');
        logger.raw(JSON.stringify(result.output, null, 2));
      }
    } else {
      logger.error(`Workflow failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof AiwfError) {
      logger.error(error.message);
    } else {
      logger.error('Workflow execution failed', error instanceof Error ? error : undefined);
    }
    process.exit(1);
  }
}

export function registerRunCommand(program: Command): void {
  program
    .command('run <workflow>')
    .description('Run a workflow')
    .option('-i, --input <input...>', 'Input parameters (key=value)')
    .option('-m, --model <model>', 'Override default model')
    .option('--dry-run', 'Preview without executing AI calls')
    .option('-v, --verbose', 'Verbose output')
    .option('-o, --output <path>', 'Output file path')
    .option('--format <format>', 'Output format (json, markdown)')
    .option('--no-save', 'Don\'t save run record')
    .action(runCommand);
}
