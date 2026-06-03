import { describe, it, expect } from 'vitest';
import {
  parseToolCalls,
  normalizeToolName,
  buildArgs,
  looksLikeToolIntent,
} from '../src/server/lib/tool-parser';

describe('normalizeToolName', () => {
  it('maps canonical names', () => {
    expect(normalizeToolName('read_file')).toBe('read_file');
    expect(normalizeToolName('write_file')).toBe('write_file');
  });
  it('maps aliases and is case/separator insensitive', () => {
    expect(normalizeToolName('edit_file')).toBe('write_file');
    expect(normalizeToolName('createFile')).toBe('write_file');
    expect(normalizeToolName('LS')).toBe('list_files');
    expect(normalizeToolName('bash')).toBe('run_command');
    expect(normalizeToolName('grep')).toBe('search_files');
    expect(normalizeToolName('open-file')).toBe('read_file');
    expect(normalizeToolName('git commit')).toBe('git_commit_push');
  });
  it('rejects unknown names', () => {
    expect(normalizeToolName('div')).toBeNull();
    expect(normalizeToolName('frobnicate')).toBeNull();
  });
});

describe('buildArgs', () => {
  it('maps alternate arg keys to canonical', () => {
    expect(buildArgs('read_file', { filepath: 'a.ts' })).toEqual({ path: 'a.ts' });
    expect(buildArgs('write_file', { file: 'a.ts', code: 'x' })).toEqual({ path: 'a.ts', content: 'x' });
    expect(buildArgs('search_files', { q: 'foo' })).toEqual({ query: 'foo' });
    expect(buildArgs('run_command', { cmd: 'npm i' })).toEqual({ command: 'npm i' });
  });
  it('list_files defaults path to "."', () => {
    expect(buildArgs('list_files', {})).toEqual({ path: '.' });
  });
  it('returns null when a required arg is missing', () => {
    expect(buildArgs('read_file', {})).toBeNull();
    expect(buildArgs('run_command', {})).toBeNull();
  });
});

describe('parseToolCalls — XML variants', () => {
  it('parses self-closing read_file with double quotes', () => {
    const calls = parseToolCalls('Voy a leer <read_file path="src/App.tsx" /> ahora');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: 'read_file', args: { path: 'src/App.tsx' } });
  });

  it('parses unquoted attributes', () => {
    const calls = parseToolCalls('<read_file path=src/index.ts>');
    expect(calls[0]).toMatchObject({ name: 'read_file', args: { path: 'src/index.ts' } });
  });

  it('parses single quotes and ignores extra attributes', () => {
    const calls = parseToolCalls("<read_file path='a.ts' reason='check' />");
    expect(calls[0]).toMatchObject({ name: 'read_file', args: { path: 'a.ts' } });
  });

  it('parses write_file paired tag and keeps content verbatim', () => {
    const content = "const x = 1;\nconsole.log(x);";
    const calls = parseToolCalls(`<write_file path="a.ts">\n${content}\n</write_file>`);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('write_file');
    expect(calls[0].args).toEqual({ path: 'a.ts', content });
  });

  it('parses tags inside markdown code fences', () => {
    const calls = parseToolCalls('```xml\n<list_files path="src" />\n```');
    expect(calls[0]).toMatchObject({ name: 'list_files', args: { path: 'src' } });
  });

  it('parses alias tags (edit_file → write_file, ls → list_files)', () => {
    const calls = parseToolCalls('<edit_file path="a.ts">hi</edit_file>\n<ls path="." />');
    const names = calls.map((c) => c.name).sort();
    expect(names).toEqual(['list_files', 'write_file']);
  });

  it('detects an unclosed (truncated) write_file', () => {
    const calls = parseToolCalls('<write_file path="big.ts">\nconst a = 1;\nconst b = ');
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('write_file');
    expect(calls[0]._unclosed).toBe(true);
    expect(calls[0].args.path).toBe('big.ts');
  });

  it('does not match arbitrary HTML/markup', () => {
    expect(parseToolCalls('<div class="foo">hi</div>')).toHaveLength(0);
  });
});

describe('parseToolCalls — JSON variants', () => {
  it('parses {tool, args}', () => {
    const calls = parseToolCalls('{"tool":"write_file","args":{"path":"a.ts","content":"x"}}');
    expect(calls[0]).toMatchObject({ name: 'write_file', args: { path: 'a.ts', content: 'x' } });
  });

  it('parses OpenAI-style {function:{name, arguments}}', () => {
    const calls = parseToolCalls('{"function":{"name":"read_file","arguments":"{\\"path\\":\\"a.ts\\"}"}}');
    expect(calls[0]).toMatchObject({ name: 'read_file', args: { path: 'a.ts' } });
  });

  it('parses a tool_calls array', () => {
    const calls = parseToolCalls(
      '{"tool_calls":[{"name":"read_file","args":{"path":"a.ts"}},{"name":"ls","args":{"path":"."}}]}',
    );
    expect(calls).toHaveLength(2);
  });

  it('parses JSON inside ```json fence', () => {
    const calls = parseToolCalls('```json\n{"tool":"run_command","args":{"command":"npm test"}}\n```');
    expect(calls[0]).toMatchObject({ name: 'run_command', args: { command: 'npm test' } });
  });
});

describe('parseToolCalls — robustness', () => {
  it('returns empty for plain prose', () => {
    expect(parseToolCalls('Listo, ya terminé la tarea.')).toHaveLength(0);
    expect(parseToolCalls('')).toHaveLength(0);
    expect(parseToolCalls(null)).toHaveLength(0);
  });

  it('de-duplicates identical calls', () => {
    const calls = parseToolCalls('<read_file path="a.ts" /> y otra vez <read_file path="a.ts" />');
    expect(calls).toHaveLength(1);
  });

  it('parses multiple distinct calls in order', () => {
    const calls = parseToolCalls('<read_file path="a.ts" />\n<read_file path="b.ts" />');
    expect(calls.map((c) => c.args.path)).toEqual(['a.ts', 'b.ts']);
  });
});

describe('looksLikeToolIntent', () => {
  it('detects partial/garbled tool intent', () => {
    expect(looksLikeToolIntent('quiero <read_file path=')).toBe(true);
    expect(looksLikeToolIntent('{"tool": "write_file"')).toBe(true);
  });
  it('is false for plain prose', () => {
    expect(looksLikeToolIntent('Aquí está la explicación de tu código.')).toBe(false);
  });
});
