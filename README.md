# AI Workflow CLI (aiwf)

A CLI tool for managing AI workflows, enabling team collaboration through Git-native version control, YAML-based workflow definitions, and multi-model support.

## Installation

```bash
npm install -g aiwf
```

## Quick Start

```bash
# Initialize project
aiwf init

# Create a workflow
aiwf create workflow my-workflow

# Run a workflow
aiwf run my-workflow --input code=src/

# List workflows
aiwf list workflows
```

## Features

- **Git-native**: Workflows stored as code, versioned via Git
- **YAML-based**: Human-readable workflow definitions with Schema validation
- **Multi-model**: Support OpenAI, Anthropic, Ollama with unified interface
- **Extensible**: Custom agents and model adapters
- **CI/CD integration**: GitHub Actions, GitLab CI templates

## Documentation

See [docs/superpowers/specs/2026-05-01-ai-workflow-cli-design.md](./docs/superpowers/specs/2026-05-01-ai-workflow-cli-design.md) for full design specification.

## License

MIT
