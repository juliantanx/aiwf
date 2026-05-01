import { cosmiconfig } from 'cosmiconfig';
import type { AiwfConfig } from '../core/types.js';
import { fileExists, readYaml, writeJson, ensureDir } from '../utils/file.js';
import { parseConfigYaml } from '../core/parser.js';
import { join } from 'path';

const CONFIG_MODULE_NAME = 'aiwf';
const AIWF_DIR = '.ai-workflows';

export async function findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
  const fs = await import('fs/promises');

  let currentPath = startPath;

  while (currentPath !== '/' && currentPath !== '') {
    const aiwfPath = join(currentPath, AIWF_DIR);
    if (await fileExists(aiwfPath)) {
      return currentPath;
    }

    const parentPath = join(currentPath, '..');
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }

  return null;
}

export async function getAiwfPath(projectRoot: string): Promise<string> {
  return join(projectRoot, AIWF_DIR);
}

export async function loadConfig(projectRoot: string): Promise<AiwfConfig> {
  const configPath = join(projectRoot, AIWF_DIR, 'config.yaml');

  if (!(await fileExists(configPath))) {
    return {
      models: {
        default: 'anthropic/claude-sonnet-4-6',
        providers: {},
      },
    };
  }

  const content = await readYaml(configPath);
  const result = parseConfigYaml(content);

  if (!result.valid) {
    console.warn('Config validation warnings:', result.errors);
  }

  return result.data;
}

export async function saveConfig(projectRoot: string, config: AiwfConfig): Promise<void> {
  const configPath = join(projectRoot, AIWF_DIR, 'config.yaml');
  const yaml = await import('js-yaml');

  await ensureDir(join(projectRoot, AIWF_DIR));
  const content = yaml.dump(config);
  await import('fs/promises').then(fs => fs.writeFile(configPath, content, 'utf-8'));
}

export async function configExists(projectRoot: string): Promise<boolean> {
  const configPath = join(projectRoot, AIWF_DIR, 'config.yaml');
  return fileExists(configPath);
}

export function getDefaultConfig(): AiwfConfig {
  return {
    models: {
      default: 'anthropic/claude-sonnet-4-6',
      providers: {},
    },
  };
}
