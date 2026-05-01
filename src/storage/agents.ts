import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import type { AgentConfig } from '../core/types.js';
import { fileExists, readYaml, ensureDir } from '../utils/file.js';
import { parseYaml } from '../core/parser.js';
import { agentRegistry } from '../agents/registry.js';
import { Agent } from '../agents/base.js';
import type { AgentInput, AgentOutput, ExecutionContext } from '../core/types.js';
import { modelRegistry } from '../models/registry.js';
import { logger } from '../utils/logger.js';

const AIWF_DIR = '.ai-workflows';
const AGENTS_DIR = 'agents';

export async function getAgentsPath(projectRoot: string): Promise<string> {
  return join(projectRoot, AIWF_DIR, AGENTS_DIR);
}

export async function listCustomAgents(projectRoot: string): Promise<Array<{
  id: string;
  path: string;
  config: AgentConfig;
}>> {
  const agentsPath = await getAgentsPath(projectRoot);

  if (!(await fileExists(agentsPath))) {
    return [];
  }

  const entries = await readdir(agentsPath);
  const agents: Array<{ id: string; path: string; config: AgentConfig }> = [];

  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;

    const filePath = join(agentsPath, entry);
    try {
      const content = await readYaml(filePath);
      const config = parseYaml<AgentConfig & { extends?: string; config?: Record<string, unknown> }>(content);

      if (config.id) {
        agents.push({
          id: config.id,
          path: filePath,
          config: config as AgentConfig,
        });
      }
    } catch (error) {
      logger.warn(`Skipped invalid agent file: ${entry}`);
    }
  }

  return agents;
}

export async function loadCustomAgent(projectRoot: string, agentId: string): Promise<Agent | null> {
  const agents = await listCustomAgents(projectRoot);
  const found = agents.find(a => a.id === agentId);

  if (!found) return null;

  const agentDef = await loadAgentDefinition(found.path);
  if (!agentDef) return null;

  return createCustomAgent(agentDef);
}

interface CustomAgentDefinition {
  apiVersion: string;
  kind: 'Agent';
  id: string;
  name: string;
  description: string;
  extends?: string;
  config?: {
    defaultModel?: string;
    systemPrompt?: string;
    parameters?: Record<string, unknown>;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  };
}

async function loadAgentDefinition(filePath: string): Promise<CustomAgentDefinition | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }

  const content = await readYaml(filePath);
  return parseYaml<CustomAgentDefinition>(content);
}

function createCustomAgent(definition: CustomAgentDefinition): Agent {
  // Get base agent if extending
  let baseAgent: Agent | undefined;
  if (definition.extends) {
    baseAgent = agentRegistry.get(definition.extends);
  }

  const config: AgentConfig = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    inputSchema: definition.config?.inputSchema ?? baseAgent?.config.inputSchema ?? {},
    outputSchema: definition.config?.outputSchema ?? baseAgent?.config.outputSchema ?? {},
    defaultModel: definition.config?.defaultModel ?? baseAgent?.config.defaultModel,
    systemPrompt: definition.config?.systemPrompt,
  };

  class CustomAgent extends Agent {
    readonly config: AgentConfig = config;
    private parameters: Record<string, unknown>;
    private baseAgent: Agent | undefined;

    constructor() {
      super();
      this.parameters = definition.config?.parameters ?? {};
      this.baseAgent = baseAgent;
    }

    async execute(input: AgentInput, context: ExecutionContext): Promise<AgentOutput> {
      // Merge parameters with input
      const mergedInput = { ...this.parameters, ...input };

      // If extending, delegate to base agent with customizations
      if (this.baseAgent) {
        return this.baseAgent.execute(mergedInput, context);
      }

      // Otherwise, execute directly with model
      return this.executeWithModel(mergedInput, context);
    }

    private async executeWithModel(input: AgentInput, context: ExecutionContext): Promise<AgentOutput> {
      const modelId = config.defaultModel ?? modelRegistry.getDefaultModel();

      try {
        // Build system prompt
        let systemPrompt = config.systemPrompt ?? 'You are a helpful AI assistant.';
        for (const [key, value] of Object.entries(this.parameters)) {
          systemPrompt = systemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }

        // Build user prompt from input
        const userPrompt = Object.entries(input)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join('\n');

        const response = await modelRegistry.chat(modelId, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        return {
          success: true,
          data: response.content,
          tokens: {
            input: response.usage.inputTokens,
            output: response.usage.outputTokens,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          data: null,
          error: message,
        };
      }
    }
  }

  return new CustomAgent();
}

export async function registerCustomAgents(projectRoot: string): Promise<void> {
  const agents = await listCustomAgents(projectRoot);

  for (const agentInfo of agents) {
    const agent = await loadCustomAgent(projectRoot, agentInfo.id);
    if (agent) {
      agentRegistry.register(agent);
    }
  }
}

export async function saveCustomAgent(projectRoot: string, config: AgentConfig & { extends?: string }): Promise<string> {
  const agentsPath = await getAgentsPath(projectRoot);
  await ensureDir(agentsPath);

  const yaml = await import('js-yaml');
  const filePath = join(agentsPath, `${config.id}.yaml`);

  const agentDef = {
    apiVersion: 'aiwf/v1',
    kind: 'Agent',
    id: config.id,
    name: config.name,
    description: config.description,
    extends: (config as AgentConfig & { extends?: string }).extends,
    config: {
      defaultModel: config.defaultModel,
      systemPrompt: config.systemPrompt,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
    },
  };

  const content = yaml.dump(agentDef);
  await import('fs/promises').then(fs => fs.writeFile(filePath, content, 'utf-8'));

  return filePath;
}
