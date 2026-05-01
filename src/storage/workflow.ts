import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import type { Workflow } from '../core/types.js';
import { fileExists, readYaml, ensureDir } from '../utils/file.js';
import { parseWorkflowYaml } from '../core/parser.js';

const AIWF_DIR = '.ai-workflows';
const WORKFLOWS_DIR = 'workflows';

export async function getWorkflowsPath(projectRoot: string): Promise<string> {
  return join(projectRoot, AIWF_DIR, WORKFLOWS_DIR);
}

export async function listWorkflows(projectRoot: string): Promise<Array<{
  name: string;
  path: string;
  workflow: Workflow;
}>> {
  const workflowsPath = await getWorkflowsPath(projectRoot);

  if (!(await fileExists(workflowsPath))) {
    return [];
  }

  const entries = await readdir(workflowsPath);
  const workflows: Array<{ name: string; path: string; workflow: Workflow }> = [];

  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;

    const filePath = join(workflowsPath, entry);
    const content = await readYaml(filePath);
    const result = parseWorkflowYaml(content);

    if (result.valid && result.data.name) {
      workflows.push({
        name: result.data.name,
        path: filePath,
        workflow: result.data,
      });
    }
  }

  return workflows;
}

export async function loadWorkflow(projectRoot: string, name: string): Promise<Workflow | null> {
  const workflows = await listWorkflows(projectRoot);
  const found = workflows.find(w => w.name === name);
  return found?.workflow ?? null;
}

export async function loadWorkflowByPath(filePath: string): Promise<Workflow | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }

  const content = await readYaml(filePath);
  const result = parseWorkflowYaml(content);

  return result.valid ? result.data : null;
}

export async function saveWorkflow(projectRoot: string, workflow: Workflow): Promise<string> {
  const workflowsPath = await getWorkflowsPath(projectRoot);
  await ensureDir(workflowsPath);

  const yaml = await import('js-yaml');
  const filePath = join(workflowsPath, `${workflow.name}.yaml`);
  const content = yaml.dump(workflow);

  await import('fs/promises').then(fs => fs.writeFile(filePath, content, 'utf-8'));

  return filePath;
}

export async function deleteWorkflow(projectRoot: string, name: string): Promise<boolean> {
  const workflowsPath = await getWorkflowsPath(projectRoot);
  const filePath = join(workflowsPath, `${name}.yaml`);

  if (!(await fileExists(filePath))) {
    return false;
  }

  await import('fs/promises').then(fs => fs.unlink(filePath));
  return true;
}

export async function workflowExists(projectRoot: string, name: string): Promise<boolean> {
  const workflowsPath = await getWorkflowsPath(projectRoot);
  const filePath = join(workflowsPath, `${name}.yaml`);
  return fileExists(filePath);
}
