// ═══════════════════════════════════════
// Universal tool-call parser
// ───────────────────────────────────────
// Many models (NVIDIA, OpenRouter, Gemini-as-text, DeepSeek, small OSS models)
// do NOT emit native function calls reliably. They write the tool invocation as
// free text instead. If we only accept ONE rigid XML shape the agent silently
// "finishes" mid-task and leaves the user stranded.
//
// This module accepts the widest reasonable surface:
//   - XML-ish tags, quoted OR unquoted attrs, extra attrs, self-closing or paired
//   - tags wrapped in markdown code fences (```xml ... ```)
//   - JSON tool calls: {"tool":"write_file","args":{...}} / {"name","arguments"} /
//     {"tool_calls":[...]} / bare arrays, optionally inside ```json fences
//   - generous tool-name aliases (edit_file→write_file, ls→list_files, bash→run_command, …)
//   - generous arg-name aliases (file/filepath→path, code/text→content, q/pattern→query, …)
//   - truncated/unclosed <write_file> (token-limit cutoff) → flagged with `_unclosed`
// ═══════════════════════════════════════

export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  _unclosed?: boolean;
}

export const KNOWN_TOOLS = new Set([
  'read_file',
  'write_file',
  'list_files',
  'search_files',
  'run_command',
  'manage_tasks',
  'git_status',
  'git_commit_push',
  'git_init_and_connect',
  'git_pull',
]);

// Maps many spellings/synonyms → canonical tool name.
const TOOL_ALIASES: Record<string, string> = {
  // read
  read_file: 'read_file', readfile: 'read_file', read: 'read_file', open_file: 'read_file',
  open: 'read_file', cat: 'read_file', view_file: 'read_file', view: 'read_file', get_file: 'read_file',
  show_file: 'read_file',
  // write
  write_file: 'write_file', writefile: 'write_file', write: 'write_file', create_file: 'write_file',
  createfile: 'write_file', edit_file: 'write_file', editfile: 'write_file', new_file: 'write_file',
  save_file: 'write_file', update_file: 'write_file', apply_patch: 'write_file', patch_file: 'write_file',
  modify_file: 'write_file',
  // list
  list_files: 'list_files', listfiles: 'list_files', list: 'list_files', ls: 'list_files',
  dir: 'list_files', list_dir: 'list_files', list_directory: 'list_files', tree: 'list_files',
  // search
  search_files: 'search_files', searchfiles: 'search_files', search: 'search_files', grep: 'search_files',
  find: 'search_files', find_in_files: 'search_files', ripgrep: 'search_files', rg: 'search_files',
  // run
  run_command: 'run_command', runcommand: 'run_command', run: 'run_command', command: 'run_command',
  bash: 'run_command', sh: 'run_command', shell: 'run_command', exec: 'run_command', execute: 'run_command',
  terminal: 'run_command', cmd: 'run_command',
  // tasks
  manage_tasks: 'manage_tasks', manage_task: 'manage_tasks',
  // git
  git_status: 'git_status', gitstatus: 'git_status',
  git_commit_push: 'git_commit_push', git_commit: 'git_commit_push', commit: 'git_commit_push',
  commit_push: 'git_commit_push', git_push: 'git_commit_push',
  git_init_and_connect: 'git_init_and_connect', git_init: 'git_init_and_connect',
  git_pull: 'git_pull', gitpull: 'git_pull',
};

export function normalizeToolName(raw: string): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s\-.]+/g, '_').replace(/^_+|_+$/g, '');
  if (TOOL_ALIASES[key]) return TOOL_ALIASES[key];
  if (KNOWN_TOOLS.has(key)) return key;
  return null;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    // case-insensitive fallback
    const found = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
    if (found && obj[found] !== undefined && obj[found] !== null) return obj[found];
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  return String(v);
}

function asBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

const PATH_KEYS = ['path', 'file', 'filename', 'filepath', 'file_path', 'dir', 'directory', 'folder', 'target'];
const CONTENT_KEYS = ['content', 'code', 'text', 'data', 'body', 'file_content', 'source', 'value'];
const QUERY_KEYS = ['query', 'q', 'search', 'pattern', 'keyword', 'term', 'text'];
const COMMAND_KEYS = ['command', 'cmd', 'cmdline', 'script', 'shell', 'run'];
const MESSAGE_KEYS = ['message', 'msg', 'commit_message', 'text'];

/**
 * Build canonical args for a given tool from a loose key/value bag plus optional
 * inner text (from a paired XML tag). Returns null if a required arg is missing.
 */
export function buildArgs(
  tool: string,
  raw: Record<string, unknown>,
  inner?: string,
): Record<string, unknown> | null {
  const innerTrim = inner !== undefined ? inner.replace(/^\s*\n/, '').replace(/\s+$/, '') : undefined;

  switch (tool) {
    case 'read_file': {
      const path = asString(pick(raw, PATH_KEYS)) ?? (innerTrim ? innerTrim.trim() : undefined);
      if (!path) return null;
      return { path };
    }
    case 'list_files': {
      const path = asString(pick(raw, PATH_KEYS)) ?? (innerTrim ? innerTrim.trim() : undefined) ?? '.';
      const maxDepth = pick(raw, ['max_depth', 'maxDepth', 'depth']);
      const args: Record<string, unknown> = { path: path || '.' };
      const md = maxDepth !== undefined ? Number(maxDepth) : undefined;
      if (md !== undefined && !Number.isNaN(md)) args.max_depth = md;
      return args;
    }
    case 'write_file': {
      const path = asString(pick(raw, PATH_KEYS));
      // inner text wins for content (that's where the code body lives in XML form)
      let content = innerTrim !== undefined ? innerTrim : asString(pick(raw, CONTENT_KEYS));
      if (!path) return null;
      if (content === undefined) content = '';
      return { path, content };
    }
    case 'search_files': {
      const query = asString(pick(raw, QUERY_KEYS)) ?? (innerTrim ? innerTrim.trim() : undefined);
      if (!query) return null;
      const args: Record<string, unknown> = { query };
      const fp = asString(pick(raw, ['file_pattern', 'filePattern', 'glob', 'pattern_files', 'ext']));
      if (fp) args.file_pattern = fp;
      return args;
    }
    case 'run_command': {
      const command = asString(pick(raw, COMMAND_KEYS)) ?? (innerTrim ? innerTrim.trim() : undefined);
      if (!command) return null;
      const args: Record<string, unknown> = { command };
      const bg = asBool(pick(raw, ['background', 'async', 'detach']));
      if (bg !== undefined) args.background = bg;
      return args;
    }
    case 'manage_tasks': {
      const action = asString(pick(raw, ['action', 'op', 'operation']));
      if (!action) return null;
      const args: Record<string, unknown> = { action };
      const taskId = asString(pick(raw, ['taskId', 'task_id', 'id']));
      if (taskId) args.taskId = taskId;
      return args;
    }
    case 'git_commit_push': {
      const message = asString(pick(raw, MESSAGE_KEYS)) ?? (innerTrim ? innerTrim.trim() : undefined);
      if (!message) return null;
      return { message };
    }
    case 'git_init_and_connect': {
      const repoName = asString(pick(raw, ['repoName', 'repo_name', 'name', 'repo']));
      if (!repoName) return null;
      const args: Record<string, unknown> = { repoName };
      const description = asString(pick(raw, ['description', 'desc']));
      if (description) args.description = description;
      const isPrivate = asBool(pick(raw, ['isPrivate', 'private', 'is_private']));
      if (isPrivate !== undefined) args.isPrivate = isPrivate;
      return args;
    }
    case 'git_status':
    case 'git_pull':
      return {};
    default:
      return null;
  }
}

let counter = 0;
function mkId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function parseAttrs(attrStr: string | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!attrStr) return out;
  // key="v" | key='v' | key=unquoted
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1];
    const val = m[3] ?? m[4] ?? m[5] ?? '';
    out[key] = val;
  }
  return out;
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

/** Parse XML-ish tags (paired and self-closing), tolerant of fences/attrs. */
function parseXmlToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let working = text;

  // 1) Paired tags: <name ...>inner</name> (inner kept verbatim for write_file)
  const pairedRe = /<([a-zA-Z_][\w.-]*)\b([^>]*?)>([\s\S]*?)<\/\1\s*>/g;
  working = working.replace(pairedRe, (full, name: string, attrs: string, inner: string) => {
    const norm = normalizeToolName(name);
    if (!norm) return full; // not a tool tag → leave so it isn't mistaken later
    const args = buildArgs(norm, parseAttrs(attrs), stripCdata(inner));
    if (args) calls.push({ id: mkId('text-xml'), name: norm, args });
    return ''; // consume so the self-closing pass doesn't re-match
  });

  // 2) Self-closing / standalone tags: <name ... /> or <name ...>
  const selfRe = /<([a-zA-Z_][\w.-]*)\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = selfRe.exec(working)) !== null) {
    const norm = normalizeToolName(m[1]);
    if (!norm) continue;
    const attrs = parseAttrs(m[2]);
    if (norm === 'write_file') {
      // write_file carries its body as inner text; a bare `<write_file ...>` is
      // the START of a paired (or truncated) tag, not a standalone call. Only
      // accept a genuine self-closing tag that already has the content inline.
      const selfClosed = /\/\s*>$/.test(m[0]);
      const hasInlineContent = pick(attrs, CONTENT_KEYS) !== undefined;
      if (!(selfClosed && hasInlineContent)) continue;
    }
    const args = buildArgs(norm, attrs, undefined);
    if (args) calls.push({ id: mkId('text-xml'), name: norm, args });
  }

  // 3) Unclosed write_file (response truncated by token/time limit)
  if (!/<\/write_file\s*>/i.test(text)) {
    const unclosed = /<write_file\b([^>]*?)>([\s\S]*)$/i.exec(text);
    if (unclosed) {
      const attrsRaw = unclosed[1];
      const trailing = unclosed[2];
      const isSelfClosed = /\/\s*$/.test(attrsRaw);
      const attrs = parseAttrs(attrsRaw);
      const path = asString(pick(attrs, PATH_KEYS));
      // Only treat as a truncated write when it isn't self-closing and there is
      // actually partial content after the opening tag.
      if (path && !isSelfClosed && trailing.trim().length > 0) {
        calls.push({
          id: mkId('text-unclosed'),
          name: 'write_file',
          args: { path, content: stripCdata(trailing) },
          _unclosed: true,
        });
      }
    }
  }

  return calls;
}

function coerceArgsBag(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    // arguments may itself be a JSON string (OpenAI style)
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* not JSON */
    }
  }
  return {};
}

function fromJsonObject(obj: Record<string, unknown>): ParsedToolCall | null {
  // OpenAI nested shape: { function: { name, arguments } }
  const fn = obj.function as Record<string, unknown> | undefined;
  const rawName =
    asString(pick(obj, ['tool', 'name', 'tool_name', 'action', 'function_name'])) ??
    (fn ? asString(pick(fn, ['name'])) : undefined);
  const norm = rawName ? normalizeToolName(rawName) : null;
  if (!norm) return null;

  let bag = coerceArgsBag(pick(obj, ['args', 'arguments', 'parameters', 'params', 'input']));
  if (Object.keys(bag).length === 0 && fn) {
    bag = coerceArgsBag(pick(fn, ['arguments', 'args', 'parameters', 'params']));
  }
  // last resort: treat the remaining top-level keys as the bag
  if (Object.keys(bag).length === 0) {
    const omit = new Set(['tool', 'name', 'tool_name', 'action', 'function_name', 'function', 'type', 'id']);
    bag = Object.fromEntries(Object.entries(obj).filter(([k]) => !omit.has(k)));
  }

  const args = buildArgs(norm, bag);
  if (!args) return null;
  return { id: mkId('text-json'), name: norm, args };
}

function collectJsonCandidates(text: string): unknown[] {
  const candidates: unknown[] = [];
  const tryPush = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    if (!/^[[{]/.test(trimmed)) return;
    try {
      candidates.push(JSON.parse(trimmed));
    } catch {
      /* ignore non-JSON */
    }
  };

  // 1) fenced blocks ```json ... ``` / ```tool ... ``` / ``` ... ```
  const fenceRe = /```(?:json|tool|tool_call|tool_calls|jsonc)?\s*\n?([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) tryPush(m[1]);

  // 2) whole text as JSON
  tryPush(text);

  return candidates;
}

function walkJson(node: unknown, out: ParsedToolCall[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if (Array.isArray(obj.tool_calls)) {
    for (const item of obj.tool_calls) walkJson(item, out);
    return;
  }
  const single = fromJsonObject(obj);
  if (single) out.push(single);
}

/** Parse JSON-style tool calls embedded in the text. */
function parseJsonToolCalls(text: string): ParsedToolCall[] {
  const out: ParsedToolCall[] = [];
  for (const cand of collectJsonCandidates(text)) walkJson(cand, out);
  return out;
}

/**
 * Parse ALL tool calls found in a free-text model response.
 * Combines XML-ish and JSON parsing and de-duplicates identical calls.
 */
export function parseToolCalls(text: string | undefined | null): ParsedToolCall[] {
  if (!text) return [];
  const calls = [...parseXmlToolCalls(text), ...parseJsonToolCalls(text)];

  const seen = new Set<string>();
  const deduped: ParsedToolCall[] = [];
  for (const c of calls) {
    const sig = `${c.name}:${JSON.stringify(c.args)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(c);
  }
  return deduped;
}

/**
 * Heuristic: does the text *look like* it intended to call a tool but we failed
 * to parse it? Used to nudge the model to re-emit in a valid format instead of
 * ending the turn (which would leave the user stranded mid-task).
 */
export function looksLikeToolIntent(text: string | undefined | null): boolean {
  if (!text) return false;
  for (const name of KNOWN_TOOLS) {
    if (text.includes(`<${name}`) || text.includes(`"${name}"`) || text.includes(`'${name}'`)) return true;
  }
  // common alias verbs in tag/JSON position
  return /<(?:edit_file|create_file|open_file|run|bash|shell|ls|grep|search|write|read)\b/i.test(text) ||
    /"(?:tool|tool_name|function_name)"\s*:/.test(text);
}
