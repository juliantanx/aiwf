import { Command } from 'commander';
import inquirer from 'inquirer';
import { findProjectRoot, loadConfig, saveConfig } from '../storage/config.js';
import { modelRegistry } from '../models/registry.js';
import { logger } from '../utils/logger.js';

type ModelsAction = 'list' | 'test' | 'add';

interface ModelsOptions {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
}

export async function modelsCommand(action: ModelsAction, options: ModelsOptions = {}): Promise<void> {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    logger.error('Not in an aiwf project. Run `aiwf init` first.');
    process.exit(1);
  }

  switch (action) {
    case 'list':
      await listModels(projectRoot);
      break;
    case 'test':
      await testModel(projectRoot, options.provider);
      break;
    case 'add':
      await addModel(projectRoot, options);
      break;
    default:
      logger.error(`Unknown action: ${action}`);
      logger.raw('Valid actions: list, test, add');
  }
}

async function listModels(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);

  logger.info('Configured models:');
  logger.newline();

  logger.raw(`Default model: ${config.models?.default ?? 'not set'}`);
  logger.newline();

  if (config.models?.providers) {
    logger.raw('Providers:');
    for (const [provider, providerConfig] of Object.entries(config.models.providers)) {
      logger.raw(`  ${provider}:`);
      if (providerConfig.apiKey) {
        const keyLen = providerConfig.apiKey.length;
        logger.raw(`    API Key: ${'*'.repeat(keyLen - 4)}${providerConfig.apiKey.slice(-4)}`);
      }
      if (providerConfig.endpoint) {
        logger.raw(`    Endpoint: ${providerConfig.endpoint}`);
      }
    }
  } else {
    logger.raw('No providers configured.');
    logger.raw('Add one with: aiwf models add --provider <name>');
  }
}

async function testModel(projectRoot: string, provider?: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  modelRegistry.setConfig(config);

  const modelId = provider ?? config.models?.default ?? 'anthropic/claude-sonnet-4-6';

  logger.startSpinner(`Testing model: ${modelId}`);

  try {
    const response = await modelRegistry.chat(modelId, [
      { role: 'user', content: 'Say "OK" if you can read this.' },
    ]);

    logger.stopSpinner(true, 'Connection successful');
    logger.raw(`Response: ${response.content.slice(0, 50)}...`);
    logger.raw(`Latency: ${response.latency}ms`);
    logger.raw(`Tokens: ${response.usage.inputTokens} in, ${response.usage.outputTokens} out`);
  } catch (error) {
    logger.stopSpinner(false, 'Connection failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error: ${message}`);
    process.exit(1);
  }
}

async function addModel(projectRoot: string, options: ModelsOptions): Promise<void> {
  const config = await loadConfig(projectRoot);

  // Get provider
  let provider = options.provider;
  if (!provider) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select provider:',
        choices: ['anthropic', 'openai', 'ollama', 'custom'],
      },
    ]);
    provider = answer.provider;
  }

  // Get API key (if not ollama)
  let apiKey = options.apiKey;
  if (provider !== 'ollama' && !apiKey) {
    const answer = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
      },
    ]);
    apiKey = answer.apiKey;
  }

  // Get endpoint (for ollama or custom)
  let endpoint = options.endpoint;
  if ((provider === 'ollama' || provider === 'custom') && !endpoint) {
    const defaultEndpoint = provider === 'ollama' ? 'http://localhost:11434' : undefined;
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'endpoint',
        message: 'Endpoint:',
        default: defaultEndpoint,
      },
    ]);
    endpoint = answer.endpoint;
  }

  // Ensure provider is defined
  if (!provider) {
    logger.error('Provider is required');
    process.exit(1);
  }

  // Update config
  if (!config.models) {
    config.models = { providers: {} };
  }
  if (!config.models.providers) {
    config.models.providers = {};
  }

  config.models.providers[provider] = {
    apiKey,
    endpoint,
  };

  // Set as default if no default set
  if (!config.models.default) {
    const defaultModels: Record<string, string> = {
      anthropic: 'anthropic/claude-sonnet-4-6',
      openai: 'openai/gpt-4o',
      ollama: 'ollama/llama3.1',
      custom: `${provider}/default`,
    };
    config.models.default = defaultModels[provider] ?? `${provider}/default`;
  }

  await saveConfig(projectRoot, config);

  logger.success(`Provider configured: ${provider}`);
  logger.raw(`Default model: ${config.models.default}`);
}

export function registerModelsCommand(program: Command): void {
  program
    .command('models <action>')
    .description('Manage model configuration')
    .option('-p, --provider <provider>', 'Provider name')
    .option('-k, --api-key <key>', 'API key')
    .option('-e, --endpoint <url>', 'Endpoint URL')
    .action(modelsCommand);
}
