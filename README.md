# AI Workflow CLI (aiwf)

A powerful CLI tool for managing AI workflows, enabling team collaboration through Git-native version control, YAML-based workflow definitions, and multi-model support.

## Features

- **Git-native**: Workflows stored as code, versioned via Git
- **YAML-based**: Human-readable workflow definitions with Schema validation
- **Multi-model**: Support OpenAI, Anthropic, Ollama with unified interface
- **Extensible**: Custom agents and model adapters
- **CI/CD integration**: GitHub Actions, GitLab CI templates
- **Git hooks**: Pre-commit, pre-push automation

## Installation

```bash
# Install globally
npm install -g aiwf

# Or use with npx
npx aiwf --help
```

## Quick Start

```bash
# Initialize project
aiwf init

# Create a workflow
aiwf create workflow my-review --template code-review

# Run a workflow
aiwf run my-review --input diff="$(git diff main)"

# List workflows
aiwf list workflows

# Validate workflow definitions
aiwf validate
```

## Workflow Example

```yaml
# .ai-workflows/workflows/code-review.yaml
apiVersion: aiwf/v1
kind: Workflow
name: code-review
version: 1.0.0
description: AI-powered code review

triggers:
  - manual
  - pull_request:
      branches: [main]

inputs:
  diff:
    type: string
    description: Code diff to review
    required: true

steps:
  - id: analyze
    agent: analyzer
    input:
      code: ${{ inputs.diff }}

  - id: review
    agent: reviewer
    input:
      code: ${{ inputs.diff }}
      analysis: ${{ steps.analyze.output }}

output:
  format: markdown
  summary: ${{ steps.review.output.summary }}
```

## Built-in Agents

| Agent | Description |
|-------|-------------|
| `analyzer` | Analyze code for quality, security, performance |
| `reviewer` | Review code with actionable feedback |
| `coder` | Generate code from descriptions |
| `tester` | Generate test cases |
| `doc-writer` | Generate documentation |
| `summarizer` | Summarize content |

## CLI Commands

### `aiwf init`

Initialize aiwf in the current project.

```bash
aiwf init
aiwf init --path /path/to/project
```

### `aiwf run <workflow>`

Execute a workflow.

```bash
aiwf run code-review --input diff="$(git diff main)"
aiwf run test-gen --input code=src/auth.ts --model openai/gpt-4o
aiwf run my-workflow --dry-run  # Preview without AI calls
```

### `aiwf create <type> [name]`

Create a workflow or custom agent.

```bash
aiwf create workflow my-review
aiwf create workflow my-review --template code-review
aiwf create agent custom-reviewer
```

### `aiwf list <type>`

List workflows, agents, runs, or models.

```bash
aiwf list workflows
aiwf list agents
aiwf list runs --workflow code-review --last 10
aiwf list models
```

### `aiwf validate [file]`

Validate workflow definitions.

```bash
aiwf validate
aiwf validate .ai-workflows/workflows/my-workflow.yaml
aiwf validate --strict
```

### `aiwf models <action>`

Manage model configuration.

```bash
aiwf models list
aiwf models test anthropic/claude-sonnet-4-6
aiwf models add --provider anthropic
```

### `aiwf hooks <action>`

Manage Git hooks.

```bash
aiwf hooks install
aiwf hooks list
aiwf hooks uninstall
```

### `aiwf runs <action>`

View run records.

```bash
aiwf runs list
aiwf runs show 2024-01-15-001 --workflow code-review
aiwf runs compare run-001 run-002 --workflow code-review
aiwf runs export run-001 --workflow code-review --format markdown
```

## Configuration

```yaml
# .ai-workflows/config.yaml
models:
  default: anthropic/claude-sonnet-4-6
  providers:
    anthropic:
      apiKey: ${ANTHROPIC_API_KEY}
    openai:
      apiKey: ${OPENAI_API_KEY}
    ollama:
      endpoint: http://localhost:11434

hooks:
  pre-commit:
    - workflow: lint-check
      failFast: true
  pre-push:
    - workflow: code-review
      branches: [main, develop]

fallback:
  enabled: true
  modelChain:
    - anthropic/claude-sonnet-4-6
    - openai/gpt-4o
    - ollama/llama3.1
```

## GitHub Actions Integration

Copy the workflow templates to `.github/workflows/`:

```bash
# AI Code Review on PRs
cp node_modules/aiwf/templates/github-actions/ai-code-review.yaml .github/workflows/

# AI Test Generation
cp node_modules/aiwf/templates/github-actions/ai-test-gen.yaml .github/workflows/

# AI Documentation Generation
cp node_modules/aiwf/templates/github-actions/ai-doc-gen.yaml .github/workflows/
```

## Custom Agents

Create custom agents in `.ai-workflows/agents/`:

```yaml
# .ai-workflows/agents/custom-reviewer.yaml
apiVersion: aiwf/v1
kind: Agent
id: custom-reviewer
name: Custom Code Reviewer
description: Team-specific code reviewer

extends: reviewer

config:
  defaultModel: anthropic/claude-sonnet-4-6
  systemPrompt: |
    You are {team_name} team's code review expert.
    Follow the team's coding standards: {coding_standards}
  parameters:
    team_name: "Backend Team"
    coding_standards: ".ai-workflows/config/standards.md"
```

## Workflow Templates

Built-in templates available:

| Template | Description |
|----------|-------------|
| `code-review` | PR code review |
| `test-gen` | Test case generation |
| `doc-gen` | Documentation generation |
| `commit-msg` | Commit message generation |
| `code-refactor` | Refactoring suggestions |
| `bug-analyzer` | Bug analysis |
| `readme-generator` | README generation |
| `api-design` | API specification design |
| `sql-analyzer` | SQL optimization |

## Development

```bash
# Clone repository
git clone https://github.com/juliantanx/aiwf.git
cd aiwf

# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Run locally
node dist/index.js --help
```

## License

MIT
