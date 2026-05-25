import { describe, it, expect } from 'vitest';
import { getLanguageFromPath, getFileIcon, formatBytes, truncate } from '../src/client/lib/utils';

describe('getLanguageFromPath', () => {
  it('returns correct language for common extensions', () => {
    expect(getLanguageFromPath('app.ts')).toBe('typescript');
    expect(getLanguageFromPath('index.js')).toBe('javascript');
    expect(getLanguageFromPath('style.css')).toBe('css');
    expect(getLanguageFromPath('page.html')).toBe('html');
    expect(getLanguageFromPath('data.json')).toBe('json');
    expect(getLanguageFromPath('main.py')).toBe('python');
    expect(getLanguageFromPath('lib.rs')).toBe('rust');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageFromPath('file.xyz')).toBe('plaintext');
    expect(getLanguageFromPath('README')).toBe('plaintext');
  });

  it('handles nested paths', () => {
    expect(getLanguageFromPath('src/components/App.tsx')).toBe('typescript');
  });
});

describe('getFileIcon', () => {
  it('returns correct icons', () => {
    expect(getFileIcon('index.ts')).toBe('📘');
    expect(getFileIcon('app.py')).toBe('🐍');
    expect(getFileIcon('page.html')).toBe('🌐');
  });

  it('returns default icon for unknown', () => {
    expect(getFileIcon('data.bin')).toBe('📄');
  });
});

describe('formatBytes', () => {
  it('formats byte sizes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
    expect(truncate('short', 10)).toBe('short');
  });
});
