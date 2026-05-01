import type { AgentConfig } from '../core/types.js';
import { Agent } from './base.js';
import { AnalyzerAgent } from './analyzer.js';
import { ReviewerAgent } from './reviewer.js';
import { CoderAgent } from './coder.js';
import { TesterAgent } from './tester.js';
import { DocWriterAgent } from './doc-writer.js';
import { SummarizerAgent } from './summarizer.js';

class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  constructor() {
    // Register built-in agents
    this.register(new AnalyzerAgent());
    this.register(new ReviewerAgent());
    this.register(new CoderAgent());
    this.register(new TesterAgent());
    this.register(new DocWriterAgent());
    this.register(new SummarizerAgent());
  }

  register(agent: Agent): void {
    this.agents.set(agent.config.id, agent);
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  list(): AgentConfig[] {
    return Array.from(this.agents.values()).map(agent => agent.config);
  }

  listIds(): string[] {
    return Array.from(this.agents.keys());
  }
}

export const agentRegistry = new AgentRegistry();
