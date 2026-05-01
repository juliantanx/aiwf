import { Command } from 'commander';
import inquirer from 'inquirer';
import { join } from 'path';
import { ensureDir, fileExists, writeJson } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { saveConfig, configExists, getDefaultConfig } from '../storage/config.js';
import { saveWorkflow } from '../storage/workflow.js';
import { isGitRepo } from '../utils/git.js';

const AIWF_DIR = '.ai-workflows';

interface InitOptions {
  path?: string;
  template?: string;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectRoot = options.path ?? process.cwd();
  const aiwfPath = join(projectRoot, AIWF_DIR);

  logger.info(`Initializing aiwf in ${projectRoot}`);

  // Check if already initialized
  if (await configExists(projectRoot)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'aiwf is already initialized. Overwrite?',
        default: false,
      },
    ]);

    if (!overwrite) {
      logger.info('Initialization cancelled.');
      return;
    }
  }

  // Create directory structure
  logger.startSpinner('Creating directory structure...');

  await ensureDir(aiwfPath);
  await ensureDir(join(aiwfPath, 'workflows'));
  await ensureDir(join(aiwfPath, 'agents'));
  await ensureDir(join(aiwfPath, 'runs'));
  await ensureDir(join(aiwfPath, 'templates'));

  logger.stopSpinner(true, 'Directory structure created');

  // Create default config
  logger.startSpinner('Creating configuration...');

  const config = getDefaultConfig();

  // Ask for default model
  const { defaultModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Select default AI model:',
      choices: [
        { name: 'Claude Sonnet 4.6 (Anthropic)', value: 'anthropic/claude-sonnet-4-6' },
        { name: 'Claude Opus 4.7 (Anthropic)', value: 'anthropic/claude-opus-4-7' },
        { name: 'GPT-4o (OpenAI)', value: 'openai/gpt-4o' },
        { name: 'GPT-4o Mini (OpenAI)', value: 'openai/gpt-4o-mini' },
        { name: 'Ollama (Local)', value: 'ollama/llama3.1' },
      ],
      default: 'anthropic/claude-sonnet-4-6',
    },
  ]);

  config.models.default = defaultModel;

  await saveConfig(projectRoot, config);
  logger.stopSpinner(true, 'Configuration created');

  // Create sample workflow
  logger.startSpinner('Creating sample workflow...');

  const sampleWorkflow: import('../core/types.js').Workflow = {
    apiVersion: 'aiwf/v1',
    kind: 'Workflow',
    name: 'hello-world',
    version: '1.0.0',
    description: 'A simple hello world workflow to test your setup',
    triggers: ['manual'],
    inputs: {
      name: {
        type: 'string',
        description: 'Your name',
        required: true,
      },
    },
    steps: [
      {
        id: 'greet',
        agent: 'summarizer',
        input: {
          content: 'Create a friendly greeting for ${inputs.name}',
        },
      },
    ],
    output: {
      format: 'text',
      message: '${steps.greet.output.summary}',
    },
  };

  await saveWorkflow(projectRoot, sampleWorkflow);
  logger.stopSpinner(true, 'Sample workflow created');

  // Create .gitignore entry
  const gitignorePath = join(projectRoot, '.gitignore');
  const gitignoreContent = '\n# AI Workflow CLI\n.ai-workflows/cache/\n.ai-workflows/runs/\n';

  if (await fileExists(gitignorePath)) {
    const fs = await import('fs/promises');
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes('.ai-workflows/')) {
      await fs.appendFile(gitignorePath, gitignoreContent);
      logger.info('Added .ai-workflows/ to .gitignore');
    }
  } else {
    const fs = await import('fs/promises');
    await fs.writeFile(gitignorePath, `# AI Workflow CLI${gitignoreContent}`);
    logger.info('Created .gitignore');
  }

  // Check for Git repo
  if (!(await isGitRepo(projectRoot))) {
    logger.warn('Not a Git repository. Consider running `git init` for version control.');
  }

  logger.newline();
  logger.success('aiwf initialized successfully!');
  logger.newline();
  logger.raw('Next steps:');
  logger.raw('  1. Set your API key:');
  logger.raw('     export ANTHROPIC_API_KEY=your-key-here');
  logger.raw('     or');
  logger.raw('     export OPENAI_API_KEY=your-key-here');
  logger.raw('  2. Run the sample workflow:');
  logger.raw('     aiwf run hello-world --input name=World');
  logger.raw('  3. Create your own workflow:');
  logger.raw('     aiwf create workflow my-workflow');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize aiwf in the current project')
    .option('-p, --path <path>', 'Project path')
    .option('-t, --template <template>', 'Template to use')
    .action(initCommand);
}
