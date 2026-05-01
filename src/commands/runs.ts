import { Command } from 'commander';
import { findProjectRoot } from '../storage/config.js';
import { listRuns, loadRun, getRunOutputPath } from '../storage/run.js';
import { logger } from '../utils/logger.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

type RunsAction = 'list' | 'show' | 'compare' | 'export';

interface RunsOptions {
  workflow?: string;
  last?: number;
  format?: string;
}

export async function runsCommand(action: RunsAction, options: RunsOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  switch (action) {
    case 'list':
      await listRunsCmd(projectRoot, options);
      break;
    case 'show':
      logger.error('Usage: aiwf runs show <runId> [--workflow <name>]');
      break;
    case 'compare':
      logger.error('Usage: aiwf runs compare <runId1> <runId2>');
      break;
    case 'export':
      logger.error('Usage: aiwf runs export <runId> [--format <format>]');
      break;
    default:
      logger.error(`Unknown action: ${action}`);
      logger.raw('Valid actions: list, show, compare, export');
  }
}

async function listRunsCmd(projectRoot: string, options: RunsOptions): Promise<void> {
  const runs = await listRuns(projectRoot, options.workflow, { limit: options.last ?? 20 });

  if (runs.length === 0) {
    logger.info('No runs found.');
    return;
  }

  logger.info(`Found ${runs.length} run(s):`);
  logger.newline();

  for (const r of runs) {
    const status = r.run.status === 'success' ? '✓' : r.run.status === 'failed' ? '✗' : '○';
    const date = r.run.timestamp.start
      ? new Date(r.run.timestamp.start).toLocaleString()
      : 'Unknown';

    logger.raw(`${status} ${r.workflow}/${r.runId}`);
    logger.raw(`  Date: ${date}`);
    logger.raw(`  Status: ${r.run.status}`);

    if (r.run.totals) {
      logger.raw(`  Duration: ${r.run.totals.duration}ms | Cost: $${r.run.totals.estimatedCost.toFixed(4)}`);
    }
    logger.newline();
  }
}

export async function showRunCommand(runId: string, options: RunsOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  if (!options.workflow) {
    logger.error('Workflow name is required. Use --workflow <name>');
    process.exit(1);
  }

  const run = await loadRun(projectRoot, options.workflow, runId);

  if (!run) {
    logger.error(`Run not found: ${options.workflow}/${runId}`);
    process.exit(1);
  }

  logger.info(`Run: ${run.id}`);
  logger.newline();

  logger.raw(`Workflow: ${run.workflow} v${run.version}`);
  logger.raw(`Status: ${run.status}`);
  logger.raw(`Trigger: ${run.trigger}`);

  if (run.timestamp.start) {
    logger.raw(`Started: ${new Date(run.timestamp.start).toLocaleString()}`);
  }
  if (run.timestamp.end) {
    logger.raw(`Ended: ${new Date(run.timestamp.end).toLocaleString()}`);
  }
  if (run.timestamp.duration) {
    logger.raw(`Duration: ${run.timestamp.duration}ms`);
  }

  if (run.git) {
    logger.newline();
    logger.raw(`Git:`);
    logger.raw(`  Branch: ${run.git.branch}`);
    logger.raw(`  Commit: ${run.git.commit}`);
    if (run.git.author) {
      logger.raw(`  Author: ${run.git.author}`);
    }
  }

  if (run.totals) {
    logger.newline();
    logger.raw(`Totals:`);
    logger.raw(`  Tokens: ${run.totals.tokens.input} in, ${run.totals.tokens.output} out`);
    logger.raw(`  Cost: $${run.totals.estimatedCost.toFixed(4)}`);
  }

  logger.newline();
  logger.raw(`Steps:`);
  for (const step of run.steps) {
    const status = step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '○';
    logger.raw(`  ${status} ${step.id}: ${step.status}`);
    if (step.duration) {
      logger.raw(`      Duration: ${step.duration}ms`);
    }
    if (step.error) {
      logger.raw(`      Error: ${step.error}`);
    }
  }

  // Try to show output
  const outputPath = join(getRunOutputPath(projectRoot, run.workflow, run.id), 'output.md');
  try {
    const output = await readFile(outputPath, 'utf-8');
    logger.newline();
    logger.raw(`Output:`);
    logger.raw(output);
  } catch {
    // Output file doesn't exist
  }
}

export function registerRunsCommand(program: Command): void {
  program
    .command('runs <action>')
    .description('View run records')
    .option('-w, --workflow <name>', 'Workflow name')
    .option('-n, --last <n>', 'Number of runs to show', parseInt)
    .option('-f, --format <format>', 'Output format')
    .action(runsCommand);

  program
    .command('runs-show <runId>')
    .description('Show run details')
    .option('-w, --workflow <name>', 'Workflow name')
    .action(showRunCommand);
}
