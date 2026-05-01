import { Command } from 'commander';
import { findProjectRoot } from '../storage/config.js';
import { listRuns, loadRun, getRunOutputPath } from '../storage/run.js';
import { logger } from '../utils/logger.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

type RunsAction = 'list' | 'show' | 'compare' | 'export';

interface RunsOptions {
  workflow?: string;
  last?: number;
  format?: string;
  runId1?: string;
  runId2?: string;
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
      logger.error('Usage: aiwf runs compare <runId1> <runId2> [--workflow <name>]');
      break;
    case 'export':
      logger.error('Usage: aiwf runs export <runId> [--workflow <name>] [--format <format>]');
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

export async function compareRunsCommand(
  runId1: string,
  runId2: string,
  options: RunsOptions = {}
): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  if (!options.workflow) {
    logger.error('Workflow name is required. Use --workflow <name>');
    process.exit(1);
  }

  const [run1, run2] = await Promise.all([
    loadRun(projectRoot, options.workflow, runId1),
    loadRun(projectRoot, options.workflow, runId2),
  ]);

  if (!run1) {
    logger.error(`Run not found: ${options.workflow}/${runId1}`);
    process.exit(1);
  }

  if (!run2) {
    logger.error(`Run not found: ${options.workflow}/${runId2}`);
    process.exit(1);
  }

  logger.info(`Comparing runs: ${runId1} vs ${runId2}`);
  logger.newline();

  // Compare basic info
  logger.raw('## Basic Info');
  logger.newline();
  logger.raw(`| Metric | ${runId1} | ${runId2} | Difference |`);
  logger.raw(`|--------|----------|----------|------------|`);
  logger.raw(`| Status | ${run1.status} | ${run2.status} | - |`);
  logger.raw(`| Trigger | ${run1.trigger} | ${run2.trigger} | - |`);

  if (run1.timestamp.duration && run2.timestamp.duration) {
    const diff = run2.timestamp.duration - run1.timestamp.duration;
    const diffStr = diff > 0 ? `+${diff}ms` : `${diff}ms`;
    logger.raw(`| Duration | ${run1.timestamp.duration}ms | ${run2.timestamp.duration}ms | ${diffStr} |`);
  }

  // Compare tokens
  if (run1.totals && run2.totals) {
    logger.newline();
    logger.raw('## Token Usage');
    logger.newline();
    logger.raw(`| Metric | ${runId1} | ${runId2} | Difference |`);
    logger.raw(`|--------|----------|----------|------------|`);

    const inputDiff = run2.totals.tokens.input - run1.totals.tokens.input;
    const outputDiff = run2.totals.tokens.output - run1.totals.tokens.output;
    const costDiff = run2.totals.estimatedCost - run1.totals.estimatedCost;

    logger.raw(`| Input Tokens | ${run1.totals.tokens.input} | ${run2.totals.tokens.input} | ${inputDiff > 0 ? '+' : ''}${inputDiff} |`);
    logger.raw(`| Output Tokens | ${run1.totals.tokens.output} | ${run2.totals.tokens.output} | ${outputDiff > 0 ? '+' : ''}${outputDiff} |`);
    logger.raw(`| Cost | $${run1.totals.estimatedCost.toFixed(4)} | $${run2.totals.estimatedCost.toFixed(4)} | ${costDiff > 0 ? '+' : ''}$${costDiff.toFixed(4)} |`);
  }

  // Compare steps
  logger.newline();
  logger.raw('## Steps Comparison');
  logger.newline();
  logger.raw(`| Step | ${runId1} Status | ${runId2} Status | Duration Diff |`);
  logger.raw(`|------|--------------|--------------|---------------|`);

  const allSteps = new Set([...run1.steps.map(s => s.id), ...run2.steps.map(s => s.id)]);
  for (const stepId of allSteps) {
    const step1 = run1.steps.find(s => s.id === stepId);
    const step2 = run2.steps.find(s => s.id === stepId);

    const status1 = step1?.status ?? 'N/A';
    const status2 = step2?.status ?? 'N/A';
    let durationDiff = '-';

    if (step1?.duration && step2?.duration) {
      const diff = step2.duration - step1.duration;
      durationDiff = diff > 0 ? `+${diff}ms` : `${diff}ms`;
    }

    logger.raw(`| ${stepId} | ${status1} | ${status2} | ${durationDiff} |`);
  }

  // Compare errors
  const errors1 = run1.steps.filter(s => s.error).map(s => `${s.id}: ${s.error}`);
  const errors2 = run2.steps.filter(s => s.error).map(s => `${s.id}: ${s.error}`);

  if (errors1.length > 0 || errors2.length > 0) {
    logger.newline();
    logger.raw('## Errors');
    logger.newline();

    if (errors1.length > 0) {
      logger.raw(`### ${runId1} Errors`);
      for (const e of errors1) {
        logger.raw(`- ${e}`);
      }
    }

    if (errors2.length > 0) {
      logger.raw(`### ${runId2} Errors`);
      for (const e of errors2) {
        logger.raw(`- ${e}`);
      }
    }
  }
}

export async function exportRunCommand(
  runId: string,
  options: RunsOptions = {}
): Promise<void> {
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

  const format = options.format ?? 'json';
  const outputPath = `${runId}-export.${format}`;

  let content: string;

  switch (format) {
    case 'json':
      content = JSON.stringify(run, null, 2);
      break;
    case 'markdown':
    case 'md':
      content = generateMarkdownReport(run);
      break;
    default:
      content = JSON.stringify(run, null, 2);
  }

  await writeFile(outputPath, content, 'utf-8');
  logger.success(`Exported run to: ${outputPath}`);
}

function generateMarkdownReport(run: import('../core/types.js').RunRecord): string {
  const lines: string[] = [
    `# Run Report: ${run.id}`,
    '',
    `**Workflow**: ${run.workflow} v${run.version}`,
    `**Status**: ${run.status}`,
    `**Trigger**: ${run.trigger}`,
    '',
    '## Timestamps',
    '',
    `- **Started**: ${run.timestamp.start ? new Date(run.timestamp.start).toLocaleString() : 'N/A'}`,
    `- **Ended**: ${run.timestamp.end ? new Date(run.timestamp.end).toLocaleString() : 'N/A'}`,
    `- **Duration**: ${run.timestamp.duration ? `${run.timestamp.duration}ms` : 'N/A'}`,
    '',
  ];

  if (run.git) {
    lines.push('## Git Context', '');
    lines.push(`- **Branch**: ${run.git.branch}`);
    lines.push(`- **Commit**: ${run.git.commit}`);
    if (run.git.author) {
      lines.push(`- **Author**: ${run.git.author}`);
    }
    lines.push('');
  }

  if (run.totals) {
    lines.push('## Totals', '');
    lines.push(`- **Input Tokens**: ${run.totals.tokens.input}`);
    lines.push(`- **Output Tokens**: ${run.totals.tokens.output}`);
    lines.push(`- **Estimated Cost**: $${run.totals.estimatedCost.toFixed(4)}`);
    lines.push('');
  }

  lines.push('## Steps', '');
  for (const step of run.steps) {
    const status = step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '○';
    lines.push(`### ${status} ${step.id}`);
    lines.push(`- **Status**: ${step.status}`);
    if (step.duration) {
      lines.push(`- **Duration**: ${step.duration}ms`);
    }
    if (step.model) {
      lines.push(`- **Model**: ${step.model}`);
    }
    if (step.error) {
      lines.push(`- **Error**: ${step.error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
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

  program
    .command('runs-compare <runId1> <runId2>')
    .description('Compare two run results')
    .option('-w, --workflow <name>', 'Workflow name')
    .action(compareRunsCommand);

  program
    .command('runs-export <runId>')
    .description('Export run results to file')
    .option('-w, --workflow <name>', 'Workflow name')
    .option('-f, --format <format>', 'Output format (json, markdown)', 'json')
    .action(exportRunCommand);
}
