import { readFile, writeFile, mkdir, access, stat, readdir, rm } from 'fs/promises';
import { dirname, join, extname, basename } from 'path';
import { constants } from 'fs';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown, pretty: boolean = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content, 'utf-8');
}

export async function readYaml(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function writeYaml(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readDirectory(dirPath: string): Promise<string[]> {
  return readdir(dirPath);
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function removeDirectory(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}

export function getExtension(filePath: string): string {
  return extname(filePath).toLowerCase();
}

export function getBaseName(filePath: string): string {
  return basename(filePath, extname(filePath));
}

export async function findFiles(
  dirPath: string,
  pattern: RegExp,
  maxDepth: number = 10
): Promise<string[]> {
  const results: string[] = [];

  async function scan(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          await scan(fullPath, depth + 1);
        }
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await scan(dirPath, 0);
  return results;
}

export async function loadEnvFile(filePath: string): Promise<Record<string, string>> {
  if (!(await fileExists(filePath))) {
    return {};
  }

  const content = await readFile(filePath, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}
