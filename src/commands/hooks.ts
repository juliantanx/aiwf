import { Command } from 'commander';
import { join } from 'path';
import { findProjectRoot, loadConfig } from '../storage/config.js';
import { installGitHook, uninstallGitHook, getGitHookPath, isGitRepo } from '../utils/git.js';
import { logger } from '../utils/logger.js';

type HooksAction = 'install' | 'uninstall' | 'list';

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
    default:
      logger.error(`Unknown action: ${action}`);
      logger.raw('Valid actions: install, uninstall, list');
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

export function registerHooksCommand(program: Command): void {
  program
    .command('hooks <action>')
    .description('Manage Git hooks')
    .option('-h, --hook <name>', 'Specific hook to install/uninstall')
    .action(hooksCommand);
}
