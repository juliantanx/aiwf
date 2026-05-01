import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { fileExists, readJson, writeJson, ensureDir, getExtension, getBaseName } from '../../src/utils/file.js';

const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'file-test');

describe('File Utils', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(TEST_DIR, 'test.txt');
      await writeFile(filePath, 'test');

      expect(await fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await fileExists(join(TEST_DIR, 'missing.txt'))).toBe(false);
    });
  });

  describe('readJson / writeJson', () => {
    it('should write and read JSON file', async () => {
      const filePath = join(TEST_DIR, 'test.json');
      const data = { name: 'test', value: 123 };

      await writeJson(filePath, data);
      const result = await readJson<{ name: string; value: number }>(filePath);

      expect(result.name).toBe('test');
      expect(result.value).toBe(123);
    });

    it('should write pretty JSON by default', async () => {
      const filePath = join(TEST_DIR, 'pretty.json');
      await writeJson(filePath, { a: 1 });

      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');

      expect(content).toContain('\n');
    });

    it('should write compact JSON when pretty is false', async () => {
      const filePath = join(TEST_DIR, 'compact.json');
      await writeJson(filePath, { a: 1 }, false);

      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');

      expect(content).not.toContain('\n');
    });
  });

  describe('getExtension / getBaseName', () => {
    it('should get file extension', () => {
      expect(getExtension('test.yaml')).toBe('.yaml');
      expect(getExtension('path/to/file.json')).toBe('.json');
    });

    it('should get base name', () => {
      expect(getBaseName('test.yaml')).toBe('test');
      expect(getBaseName('path/to/file.json')).toBe('file');
    });
  });
});
