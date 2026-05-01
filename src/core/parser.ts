import yaml from 'js-yaml';
import Ajv from 'ajv';
import type { Workflow, ValidationResult, AiwfConfig } from './types.js';

// Import schemas
import workflowSchema from '../../schemas/workflow.schema.json' with { type: 'json' };
import configSchema from '../../schemas/config.schema.json' with { type: 'json' };
import agentSchema from '../../schemas/agent.schema.json' with { type: 'json' };

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  useDefaults: true,
});

// Compile validators
const validateWorkflow = ajv.compile(workflowSchema);
const validateConfig = ajv.compile(configSchema);
const validateAgent = ajv.compile(agentSchema);

export interface ParseResult<T> {
  data: T;
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
}

export function parseYaml<T>(content: string): T {
  return yaml.load(content) as T;
}

export function parseWorkflowYaml(content: string): ParseResult<Workflow> {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  let data: Workflow;

  try {
    data = parseYaml<Workflow>(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parsing error';
    return {
      data: {} as Workflow,
      valid: false,
      errors: [{ path: '', message: `YAML parsing error: ${message}` }],
      warnings: [],
    };
  }

  // Validate against schema
  const valid = validateWorkflow(data);

  if (!valid && validateWorkflow.errors) {
    for (const error of validateWorkflow.errors) {
      errors.push({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
      });
    }
  }

  // Additional semantic validation
  const stepIds = new Set<string>();
  if (data.steps) {
    for (const step of data.steps) {
      if (stepIds.has(step.id)) {
        errors.push({
          path: `steps[${step.id}]`,
          message: `Duplicate step id: ${step.id}`,
        });
      }
      stepIds.add(step.id);
    }
  }

  // Check for potential issues
  if (data.steps && data.steps.length > 10) {
    warnings.push({
      path: 'steps',
      message: 'Workflow has many steps (>10), consider splitting into smaller workflows',
    });
  }

  return {
    data,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function parseConfigYaml(content: string): ParseResult<AiwfConfig> {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  let data: AiwfConfig;

  try {
    data = parseYaml<AiwfConfig>(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parsing error';
    return {
      data: {} as AiwfConfig,
      valid: false,
      errors: [{ path: '', message: `YAML parsing error: ${message}` }],
      warnings: [],
    };
  }

  // Validate against schema
  const valid = validateConfig(data);

  if (!valid && validateConfig.errors) {
    for (const error of validateConfig.errors) {
      errors.push({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
      });
    }
  }

  return {
    data,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateWorkflowDefinition(workflow: unknown): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  const valid = validateWorkflow(workflow);

  if (!valid && validateWorkflow.errors) {
    for (const error of validateWorkflow.errors) {
      errors.push({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateConfigDefinition(config: unknown): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  const valid = validateConfig(config);

  if (!valid && validateConfig.errors) {
    for (const error of validateConfig.errors) {
      errors.push({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAgentDefinition(agent: unknown): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  const valid = validateAgent(agent);

  if (!valid && validateAgent.errors) {
    for (const error of validateAgent.errors) {
      errors.push({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export { validateWorkflow, validateConfig, validateAgent };
