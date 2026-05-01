import { Command } from 'commander';
import { join } from 'path';
import { findProjectRoot, loadConfig } from '../storage/config.js';
import { installGitHook, uninstallGitHook, getGitHookPath, isGitRepo, getGitContext } from '../utils/git.js';
import { loadWorkflow } from '../storage/workflow.js';
import { runWorkflow } from '../core/runner.js';
import { modelRegistry } from '../models/registry.js';
import { logger } from '../utils/logger.js';

type HooksAction = 'install' | 'uninstall' | 'list' | 'exec';

interface HooksOptions {
  hook?: string;
}

const HOOK_SCRIPT = `#!/bin/sh
# AI Workflow CLI Git Hook
aiwf hooks exec $0
`;

export async function hooksCommand(action: HooksAction, options: HooksOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  switch (action) {
    case 'install':
      await installHooks(projectRoot, options.hook);
      break;
    case 'uninstall':
      await uninstallHooks(projectRoot, options.hook);
      break;
    case 'list':
      await listHooks(projectRoot);
      break;
    case 'exec':
      await execHook(projectRoot, options.hook);
      break;
    default:
      logger.error(`Unknown action: ${action}`);
      logger.raw('Valid actions: install, uninstall, list, exec');
  }
}

async function installHooks(projectRoot: string, hookName?: string): Promise<void> {
  if (!(await isGitRepo(projectRoot))) {
    logger.error('Not a Git repository.');
    process.exit(1);
  }

  const config = await loadConfig(projectRoot);
  const hooks = config.hooks ?? {};

  const hooksToInstall = hookName ? [hookName] : Object.keys(hooks);

  if (hooksToInstall.length === 0) {
    logger.info('No hooks configured. Add hooks to .ai-workflows/config.yaml');
    return;
  }

  for (const hook of hooksToInstall) {
    logger.startSpinner(`Installing hook: ${hook}`);

    try {
      await installGitHook(projectRoot, hook, HOOK_SCRIPT.replace('$0', hook));
      logger.stopSpinner(true, `Hook installed: ${hook}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.stopSpinner(false, `Failed to install hook: ${hook}`);
      logger.error(message);
    }
  }

  logger.newline();
  logger.success('Git hooks installed.');
  logger.raw('Hooks will run based on your .ai-workflows/config.yaml configuration.');
}

async function uninstallHooks(projectRoot: string, hookName?: string): Promise<void> {
  if (!(await isGitRepo(projectRoot))) {
    logger.error('Not a Git repository.');
    process.exit(1);
  }

  const hooksToUninstall = hookName ? [hookName] : ['pre-commit', 'pre-push', 'commit-msg', 'post-merge'];

  for (const hook of hooksToUninstall) {
    logger.startSpinner(`Uninstalling hook: ${hook}`);

    const removed = await uninstallGitHook(projectRoot, hook);

    if (removed) {
      logger.stopSpinner(true, `Hook removed: ${hook}`);
    } else {
      logger.stopSpinner(true, `Hook not installed: ${hook}`);
    }
  }

  logger.newline();
  logger.success('Git hooks uninstalled.');
}

async function listHooks(projectRoot: string): Promise<void> {
  if (!(await isGitRepo(projectRoot))) {
    logger.error('Not a Git repository.');
    return;
  }

  const config = await loadConfig(projectRoot);
  const configuredHooks = config.hooks ?? {};

  logger.info('Configured hooks:');
  logger.newline();

  if (Object.keys(configuredHooks).length === 0) {
    logger.raw('No hooks configured.');
    logger.raw('Add hooks to .ai-workflows/config.yaml:');
    logger.newline();
    logger.raw('hooks:');
    logger.raw('  pre-commit:');
    logger.raw('    - workflow: lint-check');
    return;
  }

  for (const [hook, workflows] of Object.entries(configuredHooks)) {
    logger.raw(`  ${hook}:`);
    for (const wf of workflows) {
      logger.raw(`    - workflow: ${wf.workflow}`);
      if (wf.failFast !== undefined) {
        logger.raw(`      failFast: ${wf.failFast}`);
      }
    }
  }
}

async function execHook(projectRoot: string, hookName?: string): Promise<void> {
  if (!hookName) {
    logger.error('Hook name is required for exec action.');
    process.exit(1);
  }

  // Extract hook name from path if full path provided
  const hook = hookName.includes('/') ? hookName.split('/').pop() ?? hookName : hookName;

  const config = await loadConfig(projectRoot);
  modelRegistry.setConfig(config);

  const hooks = config.hooks ?? {};
  const hookConfig = hooks[hook];

  if (!hookConfig || hookConfig.length === 0) {
    // No workflow configured for this hook, exit silently
    process.exit(0);
  }

  // Get git context for branch filtering
  const gitContext = await getGitContext(projectRoot);

  for (const hookWorkflow of hookConfig) {
    // Check branch filter
    if (hookWorkflow.branches && hookWorkflow.branches.length > 0) {
      if (!hookWorkflow.branches.includes(gitContext.branch)) {
        logger.debug(`Skipping workflow ${hookWorkflow.workflow} - branch ${gitContext.branch} not in filter`);
        continue;
      }
    }

    logger.info(`Running workflow: ${hookWorkflow.workflow}`);

    const workflow = await loadWorkflow(projectRoot, hookWorkflow.workflow);

    if (!workflow) {
      logger.error(`Workflow not found: ${hookWorkflow.workflow}`);
      if (hookWorkflow.failFast) {
        process.exit(1);
      }
      continue;
    }

    // Prepare inputs based on hook type
    const inputs = await prepareHookInputs(hook, projectRoot);

    try {
      const result = await runWorkflow(projectRoot, workflow, {
        inputs,
        trigger: 'hook',
      });

      if (!result.success) {
        logger.error(`Workflow ${hookWorkflow.workflow} failed: ${result.error}`);
        if (hookWorkflow.failFast) {
          process.exit(1);
        }
      } else {
        logger.success(`Workflow ${hookWorkflow.workflow} completed`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Workflow ${hookWorkflow.workflow} failed: ${message}`);
      if (hookWorkflow.failFast) {
        process.exit(1);
      }
    }
  }

  process.exit(0);
}

async function prepareHookInputs(hook: string, projectRoot: string): Promise<Record<string, unknown>> {
  const inputs: Record<string, unknown> = {};

  switch (hook) {
    case 'pre-commit':
      // Get staged files
      inputs.stagedFiles = await getStagedFiles(projectRoot);
      inputs.diff = await getStagedDiff(projectRoot);
      break;

    case 'pre-push':
      // Get commits being pushed
      inputs.commits = await getPushCommits(projectRoot);
      inputs.diff = await getPushDiff(projectRoot);
      break;

    case 'commit-msg':
      // Get commit message
      inputs.message = await getCommitMessage(projectRoot);
      break;

    case 'post-merge':
      // Get merged commits
      inputs.mergedCommits = await getMergedCommits(projectRoot);
      break;
  }

  return inputs;
}

async function getStagedFiles(projectRoot: string): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('git diff --cached --name-only', { cwd: projectRoot });
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function getStagedDiff(projectRoot: string): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('git diff --cached', { cwd: projectRoot });
    return stdout;
  } catch {
    return '';
  }
}

async function getPushCommits(projectRoot: string): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('git log @{u}..HEAD --oneline', { cwd: projectRoot });
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function getPushDiff(projectRoot: string): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('git diff @{u}..HEAD', { cwd: projectRoot });
    return stdout;
  } catch {
    return '';
  }
}

async function getCommitMessage(projectRoot: string): Promise<string> {
  const { readFile } = await import('fs/promises');
  try {
    return await readFile(join(projectRoot, '.git', 'COMMIT_EDITMSG'), 'utf-8');
  } catch {
    return '';
  }
}

async function getMergedCommits(projectRoot: string): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('git log ORIG_HEAD..HEAD --oneline', { cwd: projectRoot });
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function registerHooksCommand(program: Command): void {
  program
    .command('hooks <action>')
    .description('Manage Git hooks')
    .option('-h, --hook <name>', 'Specific hook to install/uninstall')
    .action(hooksCommand);
}
