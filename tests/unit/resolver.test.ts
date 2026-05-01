import { describe, it, expect } from '@jest/globals';
import { VariableResolver, createResolver, generateRunId } from '../../src/core/resolver.js';

describe('VariableResolver', () => {
  it('should resolve input variables', () => {
    const resolver = createResolver({ inputs: { name: 'test' } });
    expect(resolver.resolve('${{ inputs.name }}')).toBe('test');
  });

  it('should resolve nested input variables', () => {
    const resolver = createResolver({
      inputs: {
        user: { name: 'John', email: 'john@example.com' }
      }
    });
    expect(resolver.resolve('${{ inputs.user.name }}')).toBe('John');
    expect(resolver.resolve('${{ inputs.user.email }}')).toBe('john@example.com');
  });

  it('should resolve env variables', () => {
    const resolver = createResolver({ env: { API_KEY: 'secret' } });
    expect(resolver.resolve('${{ env.API_KEY }}')).toBe('secret');
  });

  it('should resolve step outputs', () => {
    const resolver = createResolver({
      steps: {
        step1: { output: { result: 'done' } }
      }
    });
    expect(resolver.resolve('${{ steps.step1.output.result }}')).toBe('done');
  });

  it('should resolve run context', () => {
    const resolver = createResolver({
      run: { id: 'test-run', timestamp: '2024-01-01' }
    });
    expect(resolver.resolve('${{ run.id }}')).toBe('test-run');
  });

  it('should resolve git context', () => {
    const resolver = createResolver({
      git: { branch: 'main', commit: 'abc123' }
    });
    expect(resolver.resolve('${{ git.branch }}')).toBe('main');
    expect(resolver.resolve('${{ git.commit }}')).toBe('abc123');
  });

  it('should resolve variables in object', () => {
    const resolver = createResolver({ inputs: { name: 'test' } });
    const result = resolver.resolve({
      title: '${{ inputs.name }}',
      nested: {
        value: '${{ inputs.name }}-suffix'
      }
    });

    expect(result).toEqual({
      title: 'test',
      nested: {
        value: 'test-suffix'
      }
    });
  });

  it('should resolve variables in array', () => {
    const resolver = createResolver({ inputs: { item: 'value' } });
    const result = resolver.resolve(['${{ inputs.item }}', 'static']);

    expect(result).toEqual(['value', 'static']);
  });

  it('should return empty string for undefined variables', () => {
    const resolver = createResolver({});
    expect(resolver.resolve('${{ inputs.missing }}')).toBe('');
  });

  it('should evaluate condition as true for truthy values', () => {
    const resolver = createResolver({ inputs: { flag: 'true' } });
    expect(resolver.evaluateCondition('${{ inputs.flag }}')).toBe(true);
  });

  it('should evaluate condition as false for falsy values', () => {
    const resolver = createResolver({ inputs: { flag: '' } });
    expect(resolver.evaluateCondition('${{ inputs.flag }}')).toBe(false);
  });
});

describe('generateRunId', () => {
  it('should generate run ID in correct format (12 char hex)', () => {
    const id = generateRunId();
    expect(id).toMatch(/^[a-f0-9]{12}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRunId());
    }
    // All IDs should be unique (UUID-based)
    expect(ids.size).toBe(100);
  });
});
