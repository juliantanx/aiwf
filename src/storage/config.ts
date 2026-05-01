import { cosmiconfig } from 'cosmiconfig';
import type { AiwfConfig } from '../core/types.js';
import { fileExists, readYaml, ensureDir } from '../utils/file.js';
import { parseConfigYaml } from '../core/parser.js';
import { join, parse, dirname } from 'path';
import { writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import { AIWF_DIR } from './constants.js';

const CONFIG_MODULE_NAME = 'aiwf';

export async function findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = startPath;
  const root = parse(currentPath).root;

  while (currentPath !== root && currentPath !== '/' && currentPath !== '') {
    const aiwfPath = join(currentPath, AIWF_DIR);
    if (await fileExists(aiwfPath)) {
      return currentPath;
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }

  // Check root directory as well
  const aiwfPath = join(root, AIWF_DIR);
  if (await fileExists(aiwfPath)) {
    return root;
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

  await ensureDir(join(projectRoot, AIWF_DIR));
  const content = yaml.dump(config);
  await writeFile(configPath, content, 'utf-8');
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
