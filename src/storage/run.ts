import { join } from 'path';
import { readdir, stat, writeFile, rm } from 'fs/promises';
import type { RunRecord } from '../core/types.js';
import { fileExists, readJson, writeJson, ensureDir } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { AIWF_DIR, RUNS_DIR } from './constants.js';

export async function getRunsPath(projectRoot: string): Promise<string> {
  return join(projectRoot, AIWF_DIR, RUNS_DIR);
}

export async function getWorkflowRunsPath(projectRoot: string, workflowName: string): Promise<string> {
  return join(projectRoot, AIWF_DIR, RUNS_DIR, workflowName);
}

export async function saveRun(projectRoot: string, run: RunRecord): Promise<string> {
  const runsPath = await getWorkflowRunsPath(projectRoot, run.workflow);
  await ensureDir(runsPath);

  const runDir = join(runsPath, run.id);
  await ensureDir(runDir);

  // Save metadata
  await writeJson(join(runDir, 'meta.json'), run);

  return runDir;
}

export async function loadRun(projectRoot: string, workflowName: string, runId: string): Promise<RunRecord | null> {
  const runDir = join(projectRoot, AIWF_DIR, RUNS_DIR, workflowName, runId);
  const metaPath = join(runDir, 'meta.json');

  if (!(await fileExists(metaPath))) {
    return null;
  }

  return readJson<RunRecord>(metaPath);
}

export async function listRuns(
  projectRoot: string,
  workflowName?: string,
  options: { limit?: number } = {}
): Promise<Array<{ runId: string; workflow: string; run: RunRecord }>> {
  const runsPath = await getRunsPath(projectRoot);

  if (!(await fileExists(runsPath))) {
    return [];
  }

  const results: Array<{ runId: string; workflow: string; run: RunRecord }> = [];
  const limit = options.limit ?? 10;

  let workflowDirs: string[];

  if (workflowName) {
    workflowDirs = [workflowName];
  } else {
    workflowDirs = await readdir(runsPath);
  }

  for (const workflowDir of workflowDirs) {
    const workflowPath = join(runsPath, workflowDir);
    const stats = await stat(workflowPath);

    if (!stats.isDirectory()) continue;

    const runDirs = await readdir(workflowPath);

    for (const runDir of runDirs) {
      const run = await loadRun(projectRoot, workflowDir, runDir);
      if (run) {
        results.push({
          runId: run.id,
          workflow: workflowDir,
          run,
        });
      }

      if (results.length >= limit) break;
    }

    if (results.length >= limit) break;
  }

  // Sort by timestamp descending
  results.sort((a, b) => {
    const timeA = new Date(a.run.timestamp?.start ?? 0).getTime();
    const timeB = new Date(b.run.timestamp?.start ?? 0).getTime();
    return timeB - timeA;
  });

  return results.slice(0, limit);
}

export async function saveRunOutput(
  projectRoot: string,
  workflowName: string,
  runId: string,
  output: unknown,
  format: 'json' | 'markdown' | 'text' = 'json'
): Promise<void> {
  const runDir = join(projectRoot, AIWF_DIR, RUNS_DIR, workflowName, runId);
  await ensureDir(runDir);

  try {
    if (format === 'json') {
      await writeJson(join(runDir, 'output.json'), output);
    } else {
      const content = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      await writeFile(join(runDir, 'output.md'), content, 'utf-8');
    }
  } catch (error) {
    logger.warn('Failed to save run output:', error);
  }
}

export async function getRunOutputPath(
  projectRoot: string,
  workflowName: string,
  runId: string
): Promise<string> {
  return join(projectRoot, AIWF_DIR, RUNS_DIR, workflowName, runId);
}

export async function deleteRun(projectRoot: string, workflowName: string, runId: string): Promise<boolean> {
  const runDir = join(projectRoot, AIWF_DIR, RUNS_DIR, workflowName, runId);

  if (!(await fileExists(runDir))) {
    return false;
  }

  try {
    await rm(runDir, { recursive: true });
    return true;
  } catch (error) {
    logger.warn(`Failed to delete run: ${runId}`, error);
    return false;
  }
}
