import { describe, it, expect } from '@jest/globals';
import { parseWorkflowYaml, parseConfigYaml } from '../../src/core/parser.js';

describe('Workflow Parser', () => {
  it('should parse valid workflow YAML', () => {
    const yaml = `
apiVersion: aiwf/v1
kind: Workflow
name: test-workflow
version: 1.0.0
description: A test workflow
steps:
  - id: step1
    agent: analyzer
    input:
      code: "test"
`;
    const result = parseWorkflowYaml(yaml);

    expect(result.valid).toBe(true);
    expect(result.data.name).toBe('test-workflow');
    expect(result.data.steps).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid workflow with missing required fields', () => {
    const yaml = `
apiVersion: aiwf/v1
kind: Workflow
name: incomplete
`;
    const result = parseWorkflowYaml(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid YAML syntax', () => {
    const yaml = `
apiVersion: aiwf/v1
  invalid indentation
name: broken
`;
    const result = parseWorkflowYaml(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect duplicate step IDs', () => {
    const yaml = `
apiVersion: aiwf/v1
kind: Workflow
name: duplicate-steps
version: 1.0.0
steps:
  - id: step1
    agent: analyzer
    input: {}
  - id: step1
    agent: reviewer
    input: {}
`;
    const result = parseWorkflowYaml(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate step id'))).toBe(true);
  });
});

describe('Config Parser', () => {
  it('should parse valid config YAML', () => {
    const yaml = `
models:
  default: anthropic/claude-sonnet-4-6
  providers:
    anthropic:
      apiKey: test-key
`;
    const result = parseConfigYaml(yaml);

    expect(result.valid).toBe(true);
    expect(result.data.models?.default).toBe('anthropic/claude-sonnet-4-6');
  });

  it('should accept empty config object', () => {
    const yaml = `{}`;
    const result = parseConfigYaml(yaml);

    expect(result.valid).toBe(true);
  });
});
