import { Command } from 'commander';
import { findProjectRoot } from '../storage/config.js';
import { listWorkflows } from '../storage/workflow.js';
import { parseWorkflowYaml } from '../core/parser.js';
import { readYaml, fileExists } from '../utils/file.js';
import { logger } from '../utils/logger.js';

interface ValidateOptions {
  strict?: boolean;
}

export async function validateCommand(file?: string, options: ValidateOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  if (file) {
    // Validate single file
    await validateFile(file, options.strict ?? false);
  } else {
    // Validate all workflows
    await validateAllWorkflows(projectRoot, options.strict ?? false);
  }
}

async function validateFile(filePath: string, _strict: boolean): Promise<void> {
  if (!(await fileExists(filePath))) {
    logger.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  logger.startSpinner(`Validating ${filePath}`);

  const content = await readYaml(filePath);
  const result = parseWorkflowYaml(content);

  if (result.valid && result.errors.length === 0) {
    logger.stopSpinner(true, 'Valid');

    if (result.warnings.length > 0) {
      logger.newline();
      logger.warn('Warnings:');
      for (const warning of result.warnings) {
        logger.raw(`  ${warning.path}: ${warning.message}`);
      }
    }
  } else {
    logger.stopSpinner(false, 'Invalid');
    logger.newline();

    for (const error of result.errors) {
      logger.error(`${error.path}: ${error.message}`);
    }

    process.exit(1);
  }
}

async function validateAllWorkflows(projectRoot: string, strict: boolean): Promise<void> {
  const workflows = await listWorkflows(projectRoot);

  if (workflows.length === 0) {
    logger.info('No workflows found.');
    return;
  }

  let hasErrors = false;
  let hasWarnings = false;

  logger.info(`Validating ${workflows.length} workflow(s)...`);
  logger.newline();

  for (const w of workflows) {
    const result = parseWorkflowYaml(await readYaml(w.path));

    if (result.valid && result.errors.length === 0) {
      logger.success(`${w.name}: Valid`);

      if (result.warnings.length > 0) {
        hasWarnings = true;
        for (const warning of result.warnings) {
          logger.raw(`  Warning: ${warning.message}`);
        }
      }
    } else {
      hasErrors = true;
      logger.error(`${w.name}: Invalid`);
      for (const error of result.errors) {
        logger.raw(`  Error: ${error.path} - ${error.message}`);
      }
    }
  }

  logger.newline();

  if (hasErrors) {
    logger.error('Validation failed with errors.');
    process.exit(1);
  } else if (hasWarnings && strict) {
    logger.error('Validation failed with warnings (strict mode).');
    process.exit(1);
  } else {
    logger.success('All workflows are valid.');
  }
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate [file]')
    .description('Validate workflow definition(s)')
    .option('--strict', 'Treat warnings as errors')
    .action(validateCommand);
}
