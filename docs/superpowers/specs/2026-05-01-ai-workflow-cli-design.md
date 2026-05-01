---
name: AI Workflow CLI Design
description: Complete design specification for aiwf - AI workflow CLI tool for team collaboration
created: 2026-05-01
---

# AI Workflow CLI (aiwf) - Design Specification

## 1. Overview

### 1.1 Purpose

Build a CLI tool for managing AI workflows, enabling team collaboration through Git-native version control, YAML-based workflow definitions, and multi-model support.

### 1.2 Target Users

Development teams who need to:
- Share and version AI workflows
- Execute AI-powered tasks (code review, test generation, documentation)
- Integrate AI workflows into CI/CD pipelines

### 1.3 Core Principles

- **Git-native**: Workflows stored as code, versioned via Git
- **Local execution**: No server required, runs entirely on developer machine
- **Model abstraction**: Support multiple AI providers with unified interface
- **Extensibility**: Custom agents, custom model adapters

---

## 2. Architecture

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Entry Layer                          │
│  aiwf init | run | list | create | validate | models | hooks   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Core Engine Layer                        │
│  Parser | Runner | Context | Resolver | Validator              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Layer                              │
│  Analyzer | Coder | Reviewer | Tester | DocWriter | Summarizer │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Model Adapter Layer                      │
│  OpenAI | Anthropic | Ollama | Custom                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Storage Layer                            │
│  Workflow definitions | Run results | Cache | Config | Logs    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Project Structure

```
aiwf/
├── src/
│   ├── commands/           # CLI command implementations
│   │   ├── init.ts
│   │   ├── run.ts
│   │   ├── create.ts
│   │   ├── list.ts
│   │   ├── validate.ts
│   │   ├── models.ts
│   │   ├── hooks.ts
│   │   └── runs.ts
│   │
│   ├── core/               # Core engine
│   │   ├── parser.ts       # YAML parsing + Schema validation
│   │   ├── runner.ts       # Workflow execution engine
│   │   ├── context.ts      # Execution context
│   │   ├── resolver.ts     # Template variable resolution
│   │   ├── validator.ts    # Schema validation
│   │   └── types.ts        # Type definitions
│   │
│   ├── agents/             # Built-in agents
│   │   ├── base.ts         # Agent base class
│   │   ├── registry.ts     # Agent registry
│   │   ├── analyzer.ts     # Code analysis
│   │   ├── coder.ts        # Code generation
│   │   ├── reviewer.ts     # Code review
│   │   ├── tester.ts       # Test generation
│   │   ├── doc-writer.ts   # Documentation generation
│   │   └── summarizer.ts   # Content summarization
│   │
│   ├── models/             # Model adapters
│   │   ├── interface.ts    # Unified interface
│   │   ├── registry.ts     # Model registry
│   │   ├── openai.ts       # OpenAI adapter
│   │   ├── anthropic.ts    # Anthropic adapter
│   │   ├── ollama.ts       # Ollama adapter
│   │   └── mock.ts         # Mock adapter for testing
│   │
│   ├── hooks/              # Git hooks
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   └── executor.ts
│   │
│   ├── storage/            # Storage management
│   │   ├── workflow.ts     # Workflow file I/O
│   │   ├── run.ts          # Run result storage
│   │   ├── config.ts       # Configuration management
│   │   └── cache.ts        # Cache management
│   │
│   ├── utils/              # Utility functions
│   │   ├── logger.ts
│   │   ├── git.ts
│   │   ├── file.ts
│   │   └── retry.ts
│   │
│   └── index.ts            # CLI entry point
│
├── schemas/                # JSON Schema definitions
│   ├── workflow.schema.json
│   ├── agent.schema.json
│   └── config.schema.json
│
├── templates/              # Built-in workflow templates
│   ├── code-review.yaml
│   ├── test-gen.yaml
│   ├── doc-gen.yaml
│   └── commit-msg.yaml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## 3. Workflow Definition Specification

### 3.1 Core Concepts

```
Workflow
  ├── apiVersion: string
  ├── kind: "Workflow"
  ├── name: string
  ├── version: string
  ├── description: string
  ├── author: string (optional)
  ├── tags: string[] (optional)
  ├── triggers: Trigger[]
  ├── inputs: InputDefinition{}
  ├── env: Record<string, string>
  ├── model: string (optional, default model)
  ├── steps: Step[]
  └── output: OutputDefinition
```

### 3.2 Complete Example

```yaml
# .ai-workflows/workflows/code-review.yaml
apiVersion: aiwf/v1
kind: Workflow
name: code-review
version: 1.0.0
description: AI-powered code review workflow

author: team-infra
tags: [review, quality]

triggers:
  - pull_request:
      branches: [main, develop]
  - manual

inputs:
  diff:
    type: string
    description: PR code diff
    required: true
  target_branch:
    type: string
    default: main

env:
  REVIEW_FOCUS: security,performance

steps:
  - id: analyze
    agent: analyzer
    model: claude-sonnet-4-6
    input:
      diff: ${{ inputs.diff }}
      focus: ${{ env.REVIEW_FOCUS }}

  - id: security-check
    agent: reviewer
    model: claude-sonnet-4-6
    condition: ${{ steps.analyze.output.has_security_concern }}
    input:
      code: ${{ inputs.diff }}
      type: security

  - id: report
    agent: reviewer
    input:
      analysis: ${{ steps.analyze.output }}
      security: ${{ steps.security-check.output }}

output:
  format: markdown
  path: .ai-workflows/results/code-review/${{ run.id }}.md
  summary: ${{ steps.report.output.summary }}
  comments: ${{ steps.report.output.comments }}
```

### 3.3 Variable System

| Source | Syntax | Example |
|--------|--------|---------|
| Input parameters | `${{ inputs.xxx }}` | `${{ inputs.diff }}` |
| Environment variables | `${{ env.xxx }}` | `${{ env.REVIEW_FOCUS }}` |
| Step outputs | `${{ steps.xxx.output }}` | `${{ steps.analyze.output }}` |
| Runtime info | `${{ run.xxx }}` | `${{ run.id }}`, `${{ run.timestamp }}` |
| Git info | `${{ git.xxx }}` | `${{ git.branch }}`, `${{ git.commit }}` |

### 3.4 Built-in Templates

| Template | Purpose |
|----------|---------|
| `code-review` | PR code review |
| `test-gen` | Test case generation |
| `doc-gen` | Documentation generation |
| `commit-msg` | Commit message generation |

---

## 4. Agent System

### 4.1 Agent Interface

```typescript
interface AgentInput {
  [key: string]: unknown;
}

interface AgentOutput {
  success: boolean;
  data: unknown;
  error?: string;
  tokens?: {
    input: number;
    output: number;
  };
}

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  defaultModel?: string;
}

abstract class Agent {
  config: AgentConfig;

  abstract execute(
    input: AgentInput,
    context: ExecutionContext
  ): Promise<AgentOutput>;

  async *stream?(
    input: AgentInput,
    context: ExecutionContext
  ): AsyncGenerator<StreamChunk>;
}
```

### 4.2 Built-in Agents

| Agent ID | Purpose | Input | Output |
|----------|---------|-------|--------|
| `analyzer` | Code analysis | `code`, `focus` | `analysis`, `metrics`, `has_security_concern` |
| `reviewer` | Code review | `code`, `type` | `summary`, `comments`, `severity` |
| `coder` | Code generation | `prompt`, `language`, `context` | `code`, `explanation` |
| `tester` | Test generation | `code`, `framework` | `tests`, `coverage_estimate` |
| `doc-writer` | Documentation | `code`, `format` | `documentation` |
| `summarizer` | Summarization | `content`, `max_length` | `summary` |

### 4.3 Custom Agent Extension

```yaml
# .ai-workflows/agents/custom-reviewer.yaml
apiVersion: aiwf/v1
kind: Agent
id: custom-reviewer
name: Custom Code Reviewer
description: Team-specific code reviewer

extends: reviewer

config:
  defaultModel: claude-sonnet-4-6

  systemPrompt: |
    You are {team_name} team's code review expert.
    Follow the team's coding standards: {coding_standards}

  parameters:
    team_name: "Backend Team"
    coding_standards: ".ai-workflows/config/standards.md"
```

---

## 5. Model Adapter Layer

### 5.1 Unified Interface

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

interface ModelResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  latency: number;
}

interface ModelAdapter {
  id: string;
  name: string;

  chat(
    messages: ChatMessage[],
    config?: ModelConfig
  ): Promise<ModelResponse>;

  chatStream?(
    messages: ChatMessage[],
    config?: ModelConfig
  ): AsyncGenerator<string>;

  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
  };
}
```

### 5.2 Model Identifier Format

```
<provider>/<model>[:variant]

Examples:
  openai/gpt-4o
  anthropic/claude-sonnet-4-6
  ollama/llama3.1
  ollama/codellama:70b
```

### 5.3 Configuration

```yaml
# .ai-workflows/config.yaml
models:
  default: anthropic/claude-sonnet-4-6

  providers:
    anthropic:
      apiKey: ${ANTHROPIC_API_KEY}

    openai:
      apiKey: ${OPENAI_API_KEY}
      organization: org-xxx

    ollama:
      endpoint: http://localhost:11434
```

### 5.4 Cost Tracking

```json
{
  "modelCalls": [
    {
      "step": "analyze",
      "model": "anthropic/claude-sonnet-4-6",
      "tokens": { "input": 1234, "output": 567 },
      "latency": 2340,
      "estimatedCost": 0.012
    }
  ],
  "totals": {
    "tokens": { "input": 1234, "output": 567 },
    "latency": 2340,
    "estimatedCost": 0.012
  }
}
```

---

## 6. Storage Design

### 6.1 Directory Structure

```
project/
├── .ai-workflows/
│   ├── config.yaml
│   ├── workflows/
│   │   ├── code-review.yaml
│   │   └── test-gen.yaml
│   ├── agents/
│   │   └── custom-reviewer.yaml
│   ├── runs/
│   │   ├── code-review/
│   │   │   ├── 2024-01-15-001/
│   │   │   │   ├── meta.json
│   │   │   │   ├── output.json
│   │   │   │   └── output.md
│   │   │   └── 2024-01-16-002/
│   │   └── test-gen/
│   ├── cache/
│   └── templates/
└── .gitignore
```

### 6.2 Run Record Format

```json
{
  "id": "2024-01-15-001",
  "workflow": "code-review",
  "version": "1.0.0",
  "status": "success",
  "trigger": "manual",
  "timestamp": {
    "start": "2024-01-15T10:30:00Z",
    "end": "2024-01-15T10:30:45Z",
    "duration": 45000
  },
  "git": {
    "branch": "feature/auth",
    "commit": "abc1234",
    "author": "developer@example.com"
  },
  "input": {
    "diff": "..."
  },
  "steps": [
    {
      "id": "analyze",
      "status": "success",
      "duration": 15000,
      "model": "anthropic/claude-sonnet-4-6",
      "tokens": { "input": 1234, "output": 567 }
    }
  ],
  "totals": {
    "duration": 45000,
    "tokens": { "input": 3234, "output": 1367 },
    "estimatedCost": 0.025
  }
}
```

---

## 7. CLI Commands

### 7.1 Command Overview

```bash
aiwf init           # Initialize project
aiwf create         # Create workflow or agent
aiwf run            # Execute workflow
aiwf list           # List workflows/agents/runs/models
aiwf validate       # Validate workflow definition
aiwf models         # Manage model configuration
aiwf hooks          # Manage Git hooks
aiwf runs           # View run records
```

### 7.2 Detailed Commands

#### `aiwf init`

```bash
aiwf init [options]

Options:
  --path        Project path (default: current directory)
  --template    Preset template (node, python, generic)
```

#### `aiwf create`

```bash
aiwf create <type> [name]

Types:
  workflow      Create workflow
  agent         Create custom agent
```

#### `aiwf run`

```bash
aiwf run <workflow> [options]

Options:
  -i, --input     Input parameters (key=value)
  -m, --model     Override default model
  --dry-run       Preview without AI calls
  -v, --verbose   Verbose output
  -o, --output    Output path
  --format        Output format (json, markdown)
  --no-save       Don't save run record
```

#### `aiwf list`

```bash
aiwf list <type>

Types:
  workflows     List workflows
  agents        List agents
  runs          List run records
  models        List available models
```

#### `aiwf validate`

```bash
aiwf validate [file]

Options:
  --strict    Treat warnings as errors
```

#### `aiwf models`

```bash
aiwf models <action>

Actions:
  list        List configured models
  test        Test model connection
  add         Add model configuration
```

#### `aiwf hooks`

```bash
aiwf hooks <action>

Actions:
  install     Install Git hooks
  uninstall   Uninstall Git hooks
  list        List installed hooks
```

#### `aiwf runs`

```bash
aiwf runs <action>

Actions:
  list        List run records
  show        Show run details
  compare     Compare two runs
  export      Export report
```

---

## 8. Git Hooks & CI Integration

### 8.1 Supported Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `pre-commit` | Before commit | Code quality check |
| `pre-push` | Before push | Full workflow check |
| `post-merge` | After merge | Automated tasks |
| `commit-msg` | Commit message | AI-generated message |

### 8.2 Hook Configuration

```yaml
# .ai-workflows/config.yaml
hooks:
  pre-commit:
    - workflow: lint-check
      failFast: true

  pre-push:
    - workflow: code-review
      branches: [main, develop]

  commit-msg:
    - workflow: commit-lint
      validateFormat: true
```

### 8.3 GitHub Actions Integration

```yaml
# .github/workflows/ai-review.yaml
name: AI Code Review

on:
  pull_request:
    branches: [main, develop]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install aiwf
        run: npm install -g aiwf

      - name: Run code review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          aiwf run code-review \
            --input diff="$(git diff origin/main...HEAD)" \
            --output pr-comment.json

      - name: Post PR Comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = JSON.parse(fs.readFileSync('pr-comment.json'));
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: output.report
            });
```

---

## 9. Error Handling

### 9.1 Error Categories

| Type | Example | Handling |
|------|---------|----------|
| Config error | YAML syntax, schema validation | Fail immediately, show location |
| Input error | Missing required parameter | Fail immediately, list missing |
| Model error | Invalid API key, rate limit | Retry + fallback |
| Network error | Timeout, connection refused | Exponential backoff retry |
| Execution error | Agent failure, output format | Log, optional skip |

### 9.2 Retry Strategy

```yaml
retry:
  maxAttempts: 3
  backoff: exponential
  initialDelay: 1000
  maxDelay: 30000

  retryOn:
    - rate_limit
    - timeout
    - server_error
```

### 9.3 Fallback Strategy

```yaml
fallback:
  enabled: true

  modelChain:
    - anthropic/claude-sonnet-4-6
    - openai/gpt-4o
    - ollama/llama3.1

  trigger:
    - errorType: rate_limit
    - errorType: server_error
      count: 3
```

---

## 10. Testing Strategy

### 10.1 Test Layers

- **Unit tests**: Parser, Resolver, Agent, Model Adapter (95% coverage target)
- **Integration tests**: CLI commands, workflow execution, model calls with mocks
- **E2E tests**: Full workflow execution, CI integration, Git hooks

### 10.2 Model Mocking

```typescript
function createMockModel(config: MockModelConfig): ModelAdapter {
  return {
    id: 'mock',
    name: 'Mock Model',
    capabilities: { streaming: true, functionCalling: true, vision: false },

    async chat(messages, options) {
      if (config.error) throw config.error;
      if (config.delay) await sleep(config.delay);
      return config.response || {
        content: 'mock response',
        usage: { inputTokens: 10, outputTokens: 10 }
      };
    }
  };
}
```

---

## 11. Development Milestones

### Phase 1: MVP (3-4 weeks)

| Feature | Priority |
|---------|----------|
| `aiwf init` | P0 |
| YAML Parser + Schema validation | P0 |
| Workflow execution engine | P0 |
| Variable resolver | P0 |
| Model adapters (OpenAI, Anthropic, Ollama) | P0 |
| Built-in agents: analyzer, reviewer | P0 |
| CLI: `run`, `validate`, `list` | P0 |
| Run result storage | P0 |
| Unit tests | P0 |

### Phase 2: Enhancement (2-3 weeks)

| Feature | Priority |
|---------|----------|
| Git hooks install & execute | P0 |
| GitHub Actions integration template | P0 |
| Built-in agents: coder, tester | P1 |
| Model fallback strategy | P1 |
| Error retry mechanism | P1 |
| CLI: `hooks`, `models` | P1 |
| Integration tests | P1 |

### Phase 3: Polish (2-3 weeks)

| Feature | Priority |
|---------|----------|
| Custom agent definition | P1 |
| Workflow template library (5-8 templates) | P1 |
| CLI: `create agent`, `runs compare` | P1 |
| Performance optimization (cache, concurrency) | P2 |
| Complete documentation | P1 |
| E2E tests | P1 |

### Phase 4: Extension (As needed)

| Feature | Description |
|---------|-------------|
| Web UI | Visual workflow editor, history viewer |
| Plugin system | Third-party agents, model adapters |
| More models | Azure OpenAI, Google Gemini, AWS Bedrock |
| Team features | Workflow sharing, permissions |

---

## 12. Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| CLI Framework | Commander |
| Interactive prompts | Inquirer |
| YAML parsing | js-yaml |
| Schema validation | Ajv |
| AI SDKs | openai, @anthropic-ai/sdk, ollama |
| Git operations | simple-git |
| Testing | Jest |
| Build | tsup |
| Package | npm (global install) |
