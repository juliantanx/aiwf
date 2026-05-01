import { Command } from 'commander';
import inquirer from 'inquirer';
import { join } from 'path';
import { findProjectRoot } from '../storage/config.js';
import { saveWorkflow, workflowExists } from '../storage/workflow.js';
import { logger } from '../utils/logger.js';
import type { Workflow } from '../core/types.js';

type CreateType = 'workflow' | 'agent';

interface CreateOptions {
  template?: string;
  edit?: boolean;
}

const WORKFLOW_TEMPLATES: Record<string, Partial<Workflow>> = {
  'code-review': {
    apiVersion: 'aiwf/v1',
    kind: 'Workflow',
    version: '1.0.0',
    description: 'AI-powered code review workflow',
    triggers: ['manual'],
    inputs: {
      diff: {
        type: 'string',
        description: 'Code diff to review',
        required: true,
      },
    },
    steps: [
      {
        id: 'analyze',
        agent: 'analyzer',
        input: {
          code: '${inputs.diff}',
        },
      },
      {
        id: 'review',
        agent: 'reviewer',
        input: {
          code: '${inputs.diff}',
          analysis: '${steps.analyze.output}',
        },
      },
    ],
    output: {
      format: 'markdown',
      summary: '${steps.review.output.summary}',
    },
  },
  'test-gen': {
    apiVersion: 'aiwf/v1',
    kind: 'Workflow',
    version: '1.0.0',
    description: 'Generate tests for code',
    triggers: ['manual'],
    inputs: {
      code: {
        type: 'string',
        description: 'Code to generate tests for',
        required: true,
      },
      framework: {
        type: 'string',
        description: 'Testing framework',
        default: 'jest',
      },
    },
    steps: [
      {
        id: 'generate',
        agent: 'tester',
        input: {
          code: '${inputs.code}',
          framework: '${inputs.framework}',
        },
      },
    ],
    output: {
      format: 'markdown',
      tests: '${steps.generate.output.tests}',
    },
  },
  'doc-gen': {
    apiVersion: 'aiwf/v1',
    kind: 'Workflow',
    version: '1.0.0',
    description: 'Generate documentation for code',
    triggers: ['manual'],
    inputs: {
      code: {
        type: 'string',
        description: 'Code to document',
        required: true,
      },
    },
    steps: [
      {
        id: 'document',
        agent: 'doc-writer',
        input: {
          code: '${inputs.code}',
        },
      },
    ],
    output: {
      format: 'markdown',
      documentation: '${steps.document.output.documentation}',
    },
  },
};

export async function createCommand(type: CreateType, name?: string, options: CreateOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  switch (type) {
    case 'workflow':
      await createWorkflow(projectRoot, name, options);
      break;
    case 'agent':
      await createAgent(projectRoot, name, options);
      break;
    default:
      logger.error(`Unknown type: ${type}`);
      logger.raw('Valid types: workflow, agent');
  }
}

async function createWorkflow(projectRoot: string, name?: string, options: CreateOptions = {}): Promise<void> {
  // Get workflow name
  if (!name) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Workflow name:',
        validate: (input) => {
          if (!input) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Name must be lowercase letters, numbers, and hyphens only';
          }
          return true;
        },
      },
    ]);
    name = answer.name;
  }

  // Check if exists
  if (await workflowExists(projectRoot, name)) {
    logger.error(`Workflow already exists: ${name}`);
    process.exit(1);
  }

  // Select template or create from scratch
  let workflow: Workflow;

  if (options.template && WORKFLOW_TEMPLATES[options.template]) {
    workflow = {
      ...WORKFLOW_TEMPLATES[options.template],
      name,
    } as Workflow;
  } else {
    const { useTemplate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useTemplate',
        message: 'Use a template?',
        default: true,
      },
    ]);

    if (useTemplate) {
      const { template } = await inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Select template:',
          choices: Object.keys(WORKFLOW_TEMPLATES),
        },
      ]);

      workflow = {
        ...WORKFLOW_TEMPLATES[template],
        name,
      } as Workflow;
    } else {
      // Create minimal workflow
      workflow = {
        apiVersion: 'aiwf/v1',
        kind: 'Workflow',
        name,
        version: '1.0.0',
        description: 'A new workflow',
        triggers: ['manual'],
        steps: [
          {
            id: 'step1',
            agent: 'summarizer',
            input: {
              content: '${inputs.content}',
            },
          },
        ],
        inputs: {
          content: {
            type: 'string',
            description: 'Content to process',
            required: true,
          },
        },
      };
    }
  }

  // Save workflow
  await saveWorkflow(projectRoot, workflow);
  logger.success(`Workflow created: ${name}`);
  logger.raw(`Path: .ai-workflows/workflows/${name}.yaml`);
}

async function createAgent(projectRoot: string, name?: string, options: CreateOptions = {}): Promise<void> {
  logger.info('Custom agent creation is not yet implemented.');
  logger.raw('You can extend built-in agents in your workflow configuration.');
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create <type> [name]')
    .description('Create a workflow or agent')
    .option('-t, --template <template>', 'Template to use')
    .option('-e, --edit', 'Open in editor after creation')
    .action(createCommand);
}
