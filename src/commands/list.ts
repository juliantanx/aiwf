import { Command } from 'commander';
import { listWorkflows } from '../storage/workflow.js';
import { findProjectRoot } from '../storage/config.js';
import { agentRegistry } from '../agents/registry.js';
import { modelRegistry } from '../models/registry.js';
import { listRuns } from '../storage/run.js';
import { logger } from '../utils/logger.js';

type ListType = 'workflows' | 'agents' | 'runs' | 'models';

interface ListOptions {
  workflow?: string;
  last?: number;
  provider?: string;
}

export async function listCommand(type: ListType, options: ListOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  switch (type) {
    case 'workflows':
      await listWorkflowsCmd(projectRoot);
      break;
    case 'agents':
      listAgentsCmd();
      break;
    case 'runs':
      await listRunsCmd(projectRoot, options);
      break;
    case 'models':
      listModelsCmd(options);
      break;
    default:
      logger.error(`Unknown list type: ${type}`);
      logger.raw('Valid types: workflows, agents, runs, models');
  }
}

async function listWorkflowsCmd(projectRoot: string | null): Promise<void> {
  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    return;
  }

  const workflows = await listWorkflows(projectRoot);

  if (workflows.length === 0) {
    logger.info('No workflows found.');
    logger.raw('Create one with: aiwf create workflow <name>');
    return;
  }

  logger.info(`Found ${workflows.length} workflow(s):`);
  logger.newline();

  for (const w of workflows) {
    logger.raw(`  ${w.name} (${w.workflow.version})`);
    if (w.workflow.description) {
      logger.raw(`    ${w.workflow.description}`);
    }
    logger.raw(`    Steps: ${w.workflow.steps.length}`);
  }
}

function listAgentsCmd(): void {
  const agents = agentRegistry.list();

  logger.info(`Available agents (${agents.length}):`);
  logger.newline();

  for (const agent of agents) {
    logger.raw(`  ${agent.id}`);
    logger.raw(`    ${agent.description}`);
  }
}

async function listRunsCmd(projectRoot: string | null, options: ListOptions): Promise<void> {
  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    return;
  }

  const runs = await listRuns(projectRoot, options.workflow, { limit: options.last ?? 10 });

  if (runs.length === 0) {
    logger.info('No runs found.');
    return;
  }

  logger.info(`Recent runs (${runs.length}):`);
  logger.newline();

  for (const r of runs) {
    const status = r.run.status === 'success' ? '✓' : r.run.status === 'failed' ? '✗' : '○';
    const date = r.run.timestamp.start
      ? new Date(r.run.timestamp.start).toLocaleString()
      : 'Unknown';

    logger.raw(`  ${status} ${r.workflow}/${r.runId}`);
    logger.raw(`    Status: ${r.run.status}`);
    logger.raw(`    Date: ${date}`);

    if (r.run.totals) {
      logger.raw(`    Duration: ${r.run.totals.duration}ms`);
      logger.raw(`    Cost: $${r.run.totals.estimatedCost.toFixed(4)}`);
    }
  }
}

function listModelsCmd(options: ListOptions): void {
  const adapters = modelRegistry.listAdapters();
  const filtered = options.provider
    ? adapters.filter(a => a.id === options.provider)
    : adapters;

  logger.info(`Configured model providers (${filtered.length}):`);
  logger.newline();

  for (const adapter of filtered) {
    logger.raw(`  ${adapter.id}`);
    logger.raw(`    Name: ${adapter.name}`);
  }

  logger.newline();
  logger.raw(`Default model: ${modelRegistry.getDefaultModel()}`);
}

export function registerListCommand(program: Command): void {
  program
    .command('list <type>')
    .description('List workflows, agents, runs, or models')
    .option('-w, --workflow <name>', 'Filter runs by workflow')
    .option('-n, --last <n>', 'Number of items to show', (s: string) => parseInt(s, 10))
    .option('-p, --provider <provider>', 'Filter models by provider')
    .action(listCommand);
}
