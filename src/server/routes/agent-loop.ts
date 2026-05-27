import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { execSync, spawn, ChildProcess } from 'child_process';
import { join, resolve, dirname } from 'path';
import { config } from '../config';
import type { AIProvider } from '@shared/types';

export const agentRouter = Router();

// ═══════════════════════════════════════
// Tool definitions (JSON schema format)
// ═══════════════════════════════════════

const TOOL_DEFS = [
  {
    name: 'read_file',
    description: 'Read the full contents of a file from the project. Use this when you need to see what a file contains before answering or making changes.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative file path from the project root, e.g. "src/index.ts"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with new content. Always write the COMPLETE file content.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative file path from the project root' },
        content: { type: 'string', description: 'Complete file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List all files and directories in a directory. Use "." for the project root.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative directory path. Use "." for project root.' },
        max_depth: { type: 'number', description: 'Max recursion depth (default 2)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for a text string across all files in the project. Returns matching lines with file names and line numbers.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Text to search for (case-insensitive)' },
        file_pattern: { type: 'string', description: 'File extension filter, e.g. "*.ts" (optional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the project directory. Use for npm install, build commands, etc. If the command is a long-running server (like npm run dev), set background to true.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        background: { type: 'boolean', description: 'Run asynchronously in background (true for servers, watch commands, etc.)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'manage_tasks',
    description: 'Manage background tasks started with run_command.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['list', 'status', 'kill'], description: 'Action to perform' },
        taskId: { type: 'string', description: 'Required for status or kill' },
      },
      required: ['action'],
    },
  },
  {
    name: 'git_status',
    description: 'Get the current git status of the project: branch name, changed files, and remote info. Use this to check if there are uncommitted changes.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_commit_push',
    description: 'Stage all changes, commit with a message, and push to the remote repository automatically. If a GitHub token is provided in the request, it will be used for authentication.',
    parameters: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Commit message describing the changes' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_init_and_connect',
    description: 'Initialize a git repository, create a new GitHub repo, and connect them. Use when the user wants to create a new repository for their project.',
    parameters: {
      type: 'object' as const,
      properties: {
        repoName: { type: 'string', description: 'Name for the new GitHub repository' },
        description: { type: 'string', description: 'Description for the new GitHub repository' },
        isPrivate: { type: 'boolean', description: 'Whether the repo should be private (default: false)' },
      },
      required: ['repoName'],
    },
  },
  {
    name: 'git_pull',
    description: 'Pull the latest changes from the remote repository.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// ═══════════════════════════════════════
// Tool execution
// ═══════════════════════════════════════

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv']);
const backgroundTasks = new Map<string, { cmd: string; process: ChildProcess; logs: string[] }>();

function safePath(root: string, rel: string): string | null {
  const full = resolve(root, rel);
  if (!full.startsWith(resolve(root))) return null;
  return full;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  projectRoot: string,
): Promise<{ result: string; fileChange?: { path: string; content: string; oldContent?: string } }> {
  try {
    switch (name) {
      case 'read_file': {
        const p = safePath(projectRoot, args.path as string);
        if (!p) return { result: 'Error: ruta no permitida (path traversal)' };
        if (!existsSync(p)) return { result: `Error: archivo no encontrado: ${args.path}` };
        const content = readFileSync(p, 'utf-8');
        // Cap at 60k chars to avoid token overflow
        if (content.length > 60000) {
          return { result: content.slice(0, 60000) + '\n\n... (truncado, archivo muy grande)' };
        }
        return { result: content };
      }

      case 'write_file': {
        const p = safePath(projectRoot, args.path as string);
        if (!p) return { result: 'Error: ruta no permitida' };
        const dir = dirname(p);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        let oldContent: string | undefined;
        if (existsSync(p)) {
          oldContent = readFileSync(p, 'utf-8');
        }
        const content = args.content as string;
        writeFileSync(p, content, 'utf-8');
        return {
          result: `✅ Archivo escrito: ${args.path} (${content.length} chars)`,
          fileChange: { path: args.path as string, content, oldContent },
        };
      }

      case 'list_files': {
        const p = safePath(projectRoot, (args.path as string) || '.');
        if (!p) return { result: 'Error: ruta no permitida' };
        if (!existsSync(p)) return { result: `Error: directorio no encontrado: ${args.path}` };
        const maxDepth = (args.max_depth as number) || 2;
        const tree = buildTreeCompact(p, 0, maxDepth);
        return { result: tree.join('\n') || '(directorio vacío)' };
      }

      case 'search_files': {
        const query = (args.query as string).toLowerCase();
        const pattern = args.file_pattern as string | undefined;
        const results = searchInFiles(projectRoot, query, pattern);
        if (results.length === 0) return { result: `No se encontraron coincidencias para "${args.query}"` };
        return { result: results.slice(0, 50).join('\n') };
      }

      case 'manage_tasks': {
        const action = args.action as string;
        const taskId = args.taskId as string;
        if (action === 'list') {
          if (backgroundTasks.size === 0) return { result: 'No hay tareas en segundo plano activas.' };
          const list = Array.from(backgroundTasks.entries()).map(([id, t]) => `- ID: ${id} | Cmd: ${t.cmd}`).join('\n');
          return { result: `Tareas activas:\n${list}` };
        }
        const task = backgroundTasks.get(taskId);
        if (!task) return { result: `Error: No se encontró la tarea ${taskId}` };
        
        if (action === 'status') {
          return { result: `Logs de tarea ${taskId} (${task.cmd}):\n${task.logs.slice(-20).join('')}` };
        }
        if (action === 'kill') {
          task.process.kill();
          backgroundTasks.delete(taskId);
          return { result: `Tarea ${taskId} terminada exitosamente.` };
        }
        return { result: 'Acción desconocida' };
      }

      case 'run_command': {
        const cmd = args.command as string;
        const isBg = !!args.background;
        const blocked = ['rm -rf /', 'format', 'del /s', 'rmdir /s'];
        if (blocked.some((b) => cmd.includes(b))) return { result: 'Error: comando bloqueado por seguridad' };

        if (isBg) {
          const taskId = Date.now().toString(36);
          const parts = cmd.split(' ');
          const child = spawn(parts[0], parts.slice(1), { cwd: projectRoot, shell: true });
          const logs: string[] = [];
          
          child.stdout?.on('data', (data) => {
            logs.push(data.toString());
            if (logs.length > 100) logs.shift();
          });
          child.stderr?.on('data', (data) => {
            logs.push(`[ERR] ${data.toString()}`);
            if (logs.length > 100) logs.shift();
          });
          child.on('exit', () => backgroundTasks.delete(taskId));
          child.on('error', (err) => logs.push(`[SYSTEM_ERR] ${err.message}`));
          
          backgroundTasks.set(taskId, { cmd, process: child, logs });
          return { result: `✅ Comando iniciado en segundo plano. Task ID: ${taskId}. Usa la herramienta manage_tasks para ver los logs o detenerlo.` };
        }

        try {
          const stdout = execSync(cmd, { cwd: projectRoot, timeout: 60000, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 });
          return { result: stdout.slice(0, 10000) || '(comando ejecutado sin salida)' };
        } catch (e: any) {
          const stderr = e.stderr?.slice(0, 5000) || e.message;
          return { result: `Error (exit ${e.status ?? '?'}): ${stderr}` };
        }
      }

      case 'git_status': {
        try {
          const statusOut = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
          const branchOut = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }).trim();
          let remoteOut = '';
          try { remoteOut = execSync('git remote -v', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }); } catch { /* no remote */ }
          const changes = statusOut.trim() || 'Sin cambios pendientes';
          return { result: `Branch: ${branchOut}\nCambios:\n${changes}\nRemotos:\n${remoteOut || 'Ninguno'}` };
        } catch (e: any) {
          if (e.message?.includes('not a git repository') || e.stderr?.includes('not a git repository')) {
            return { result: 'Este proyecto NO es un repositorio Git. Usa git_init_and_connect para inicializarlo.' };
          }
          return { result: `Error: ${e.message}` };
        }
      }

      case 'git_commit_push': {
        const msg = (args.message as string) || 'Auto-commit from CodeAI';
        try {
          execSync('git add -A', { cwd: projectRoot, encoding: 'utf-8', timeout: 15000 });
          const commitResult = execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: projectRoot, encoding: 'utf-8', timeout: 15000 });
          let pushResult = '';
          try {
            pushResult = execSync('git push', { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });
          } catch (pushErr: any) {
            pushResult = `Push falló (quizás no hay remoto configurado): ${pushErr.stderr || pushErr.message}`;
          }
          return { result: `✅ Commit exitoso:\n${commitResult}\nPush:\n${pushResult || 'OK'}` };
        } catch (e: any) {
          return { result: `Error en commit: ${e.stderr || e.message}` };
        }
      }

      case 'git_init_and_connect': {
        const repoName = args.repoName as string;
        const desc = (args.description as string) || '';
        const isPriv = !!args.isPrivate;

        // Step 1: git init if needed
        try {
          execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, encoding: 'utf-8' });
        } catch {
          execSync('git init', { cwd: projectRoot, encoding: 'utf-8' });
        }

        // Step 2: Create GitHub repo (we need the token from the request headers)
        // The token is passed via the request context
        const ghToken = (global as any).__codeai_github_token__;
        if (!ghToken) {
          return { result: 'Error: No hay token de GitHub configurado. Ve a Settings y agrega tu Personal Access Token de GitHub.' };
        }

        try {
          const createResp = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'CodeAI-Studio/2.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: repoName, description: desc, private: isPriv, auto_init: false }),
          });
          const repoData = await createResp.json();
          if (!createResp.ok) {
            return { result: `Error creando repo en GitHub: ${repoData.message || createResp.status}` };
          }

          // Step 3: Connect remote
          const cloneUrl = repoData.clone_url;
          try { execSync(`git remote remove origin`, { cwd: projectRoot }); } catch { /* no existing */ }
          execSync(`git remote add origin ${cloneUrl}`, { cwd: projectRoot });

          // Step 4: Initial commit and push
          execSync('git add -A', { cwd: projectRoot });
          try {
            execSync('git commit -m "Initial commit from CodeAI"', { cwd: projectRoot });
          } catch { /* maybe already committed */ }
          
          const authedUrl = cloneUrl.replace('https://', `https://x-access-token:${ghToken}@`);
          try {
            execSync(`git push ${authedUrl} HEAD`, { cwd: projectRoot, timeout: 30000 });
          } catch (pushErr: any) {
            return { result: `✅ Repo creado: ${repoData.html_url}\n⚠️ Push falló: ${pushErr.stderr || pushErr.message}\nRemoto configurado como origin.` };
          }

          return { result: `✅ ¡Repositorio creado y conectado!\n🔗 ${repoData.html_url}\n📦 Remote: origin → ${cloneUrl}\n🚀 Primer push realizado exitosamente.` };
        } catch (e: any) {
          return { result: `Error: ${e.message}` };
        }
      }

      case 'git_pull': {
        try {
          const result = execSync('git pull', { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });
          return { result: result || 'Pull completado (sin cambios nuevos)' };
        } catch (e: any) {
          return { result: `Error en pull: ${e.stderr || e.message}` };
        }
      }

      default:
        return { result: `Error: herramienta desconocida "${name}"` };
    }
  } catch (e: any) {
    return { result: `Error ejecutando ${name}: ${e.message}` };
  }
}

function buildTreeCompact(dir: string, depth: number, maxDepth: number, prefix = ''): string[] {
  if (depth >= maxDepth || !existsSync(dir)) return [];
  const out: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(`${prefix}📁 ${entry.name}/`);
        out.push(...buildTreeCompact(path, depth + 1, maxDepth, prefix + '  '));
      } else {
        const stat = statSync(path);
        out.push(`${prefix}📄 ${entry.name} (${formatSize(stat.size)})`);
      }
    }
  } catch { /* ignore permission errors */ }
  return out;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function searchInFiles(dir: string, query: string, pattern?: string, depth = 0): string[] {
  if (depth > 4 || !existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= 50) break;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...searchInFiles(fullPath, query, pattern, depth + 1));
      } else {
        // Check file pattern
        if (pattern) {
          const ext = pattern.replace('*', '');
          if (!entry.name.endsWith(ext)) continue;
        }
        // Skip binary files
        const binaryExts = ['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz'];
        if (binaryExts.some((e) => entry.name.endsWith(e))) continue;

        try {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < 50; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              const relPath = fullPath.replace(dir.length === fullPath.length ? dir : dir + (dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'), '').replace(/\\/g, '/');
              results.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
            }
          }
        } catch { /* skip unreadable */ }
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

// ═══════════════════════════════════════
// Provider adapters for tool-use
// ═══════════════════════════════════════

interface ProviderAdapter {
  buildBody(model: string, messages: any[], system: string): object;
  getEndpoint(model?: string): string;
  getHeaders(apiKey: string): Record<string, string>;
  parseResponse(json: any): { text?: string; toolCalls?: { id: string; name: string; args: Record<string, unknown> }[] };
  buildToolResult(toolCallId: string, toolName: string, result: string): any;
}

/** OpenAI-compatible adapter (OpenAI, DeepSeek, NVIDIA, OpenRouter) */
function openaiAdapter(endpoint: string, extra?: Record<string, string>): ProviderAdapter {
  return {
    buildBody(model, messages, system) {
      const formattedMessages = messages.map((m: any) => {
        if (m.attachments && m.attachments.length > 0) {
          const content: any[] = [{ type: 'text', text: m.content || '' }];
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              content.push({ type: 'image_url', image_url: { url: att.content } });
            }
          }
          return { role: m.role, content, reasoning_content: m.reasoning_content };
        }
        return { role: m.role, content: m.content, name: m.name, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id, reasoning_content: m.reasoning_content };
      });

      return {
        model,
        messages: [{ role: 'system', content: system }, ...formattedMessages],
        tools: TOOL_DEFS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
        max_tokens: 8192,
      };
    },
    getEndpoint() { return endpoint; },
    getHeaders(apiKey) { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, ...extra }; },
    parseResponse(json) {
      const msg = json.choices?.[0]?.message;
      if (!msg) return {};
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          text: msg.content || undefined,
          toolCalls: msg.tool_calls.map((tc: any) => {
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              console.error('Failed to parse tool arguments:', tc.function.arguments);
              parsedArgs = { _error: 'JSON parse error: invalid format' };
            }
            return {
              id: tc.id,
              name: tc.function.name,
              args: parsedArgs,
            };
          }),
        };
      }
      return { text: msg.content || '' };
    },
    buildToolResult(toolCallId, _toolName, result) {
      return { role: 'tool', tool_call_id: toolCallId, content: result };
    },
  };
}

/** Claude (Anthropic) adapter */
const claudeAdapter: ProviderAdapter = {
  buildBody(model, messages, system) {
    const formattedMessages = messages.filter((m: any) => m.role !== 'system').map((m: any) => {
      if (m.attachments && m.attachments.length > 0) {
        const content: any[] = [{ type: 'text', text: m.content || '' }];
        for (const att of m.attachments) {
          if (att.type === 'image' && att.content) {
            const base64Data = att.content.split(',')[1];
            if (base64Data) {
              content.push({ type: 'image', source: { type: 'base64', media_type: att.mime, data: base64Data } });
            }
          }
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    return {
      model,
      system,
      messages: formattedMessages,
      tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      max_tokens: 8192,
    };
  },
  getEndpoint() { return 'https://api.anthropic.com/v1/messages'; },
  getHeaders(apiKey) {
    return { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  },
  parseResponse(json) {
    const content = json.content;
    if (!content || !Array.isArray(content)) return {};

    const text = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const toolUses = content.filter((b: any) => b.type === 'tool_use');

    if (toolUses.length > 0) {
      return {
        text: text || undefined,
        toolCalls: toolUses.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          args: tc.input || {},
        })),
      };
    }
    return { text };
  },
  buildToolResult(toolCallId, _toolName, result) {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolCallId, content: result }] };
  },
};

/** Gemini adapter */
const geminiAdapter: ProviderAdapter = {
  buildBody(model, messages, system) {
    void model; // model is used in the URL
    return {
      contents: messages.map((m: any) => {
        const parts = m.parts ? [...m.parts] : [{ text: m.content || '' }];
        if (m.attachments && m.attachments.length > 0) {
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              const base64Data = att.content.split(',')[1];
              if (base64Data) {
                parts.push({ inlineData: { mimeType: att.mime, data: base64Data } });
              }
            }
          }
        }
        return {
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : m.role === 'function' ? 'function' : 'user',
          parts,
        };
      }),
      systemInstruction: { parts: [{ text: system }] },
      tools: [{ functionDeclarations: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
    };
  },
  getEndpoint(model) { return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`; },
  getHeaders(apiKey) { return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }; },
  parseResponse(json) {
    const parts = json.candidates?.[0]?.content?.parts;
    if (!parts) return {};

    const textParts = parts.filter((p: any) => p.text);
    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      return {
        text: textParts.map((p: any) => p.text).join('') || undefined,
        toolCalls: functionCalls.map((p: any, i: number) => ({
          id: `gemini-${Date.now()}-${i}`,
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        })),
      };
    }
    return { text: textParts.map((p: any) => p.text).join('') };
  },
  buildToolResult(_toolCallId, toolName, result) {
    return {
      role: 'function',
      parts: [{ functionResponse: { name: toolName, response: { result } } }],
    };
  },
};

function getAdapter(provider: AIProvider): ProviderAdapter {
  switch (provider) {
    case 'claude': return claudeAdapter;
    case 'openai': return openaiAdapter('https://api.openai.com/v1/chat/completions');
    case 'deepseek': return openaiAdapter('https://api.deepseek.com/chat/completions');
    case 'nvidia': return openaiAdapter('https://integrate.api.nvidia.com/v1/chat/completions');
    case 'openrouter': return openaiAdapter('https://openrouter.ai/api/v1/chat/completions', {
      'HTTP-Referer': 'https://codeai.studio', 'X-Title': 'CodeAI Studio',
    });
    case 'gemini': return geminiAdapter;
    default: return openaiAdapter('https://api.openai.com/v1/chat/completions');
  }
}

function resolveApiKey(provider: AIProvider, clientKey?: string): string {
  if (clientKey) return clientKey;
  switch (provider) {
    case 'claude': return config.anthropicApiKey;
    case 'openai': return config.openaiApiKey;
    case 'deepseek': return config.deepseekApiKey;
    case 'nvidia': return config.nvidiaApiKey;
    case 'openrouter': return config.openrouterApiKey;
    case 'gemini': return config.geminiApiKey;
    default: return '';
  }
}

// ═══════════════════════════════════════
// Agent loop endpoint
// ═══════════════════════════════════════

agentRouter.post('/', async (req: Request, res: Response) => {
  const { messages, model, provider, system, projectRoot, maxIterations = 1000, githubToken } = req.body;

  // Store GitHub token for git tools
  if (githubToken) (global as any).__codeai_github_token__ = githubToken;

  if (!messages || !model || !provider || !projectRoot) {
    return res.status(400).json({ error: 'Missing required fields: messages, model, provider, projectRoot' });
  }

  // Resolve API key from headers or server config
  const clientKey = (req.headers['x-api-key'] as string)
    || (req.headers['authorization'] as string)?.replace('Bearer ', '')
    || req.body.apiKey
    || '';
  const apiKey = resolveApiKey(provider, clientKey || undefined);
  if (!apiKey) {
    return res.status(401).json({ error: `No API key configured for provider: ${provider}` });
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const adapter = getAdapter(provider);
  let conversationMessages = [...messages];
  let iteration = 0;

  try {
    while (iteration < maxIterations) {
      iteration++;

      // Call the AI provider (non-streaming to get full response with tool calls)
      const body = adapter.buildBody(model, conversationMessages, system || '');
      const endpoint = adapter.getEndpoint(model);
      const headers = adapter.getHeaders(apiKey);

      // For Gemini, add apiKey as query param
      const url = provider === 'gemini' ? `${endpoint}?key=${apiKey}` : endpoint;
      const fetchHeaders = provider === 'gemini'
        ? { 'Content-Type': 'application/json' }
        : headers;

      sendEvent('status', { type: 'thinking', iteration });

      const response = await fetch(url, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        sendEvent('error', { message: `API error ${response.status}: ${errText.slice(0, 300)}` });
        break;
      }

      const json = await response.json();
      const parsed = adapter.parseResponse(json);

      // If there are tool calls, execute them
      if (parsed.toolCalls && parsed.toolCalls.length > 0) {
        // Send any partial text
        if (parsed.text) {
          sendEvent('content', { text: parsed.text });
        }

        // Add the assistant message to conversation (with tool calls)
        if (provider === 'claude') {
          conversationMessages.push({ role: 'assistant', content: json.content });
        } else if (provider === 'gemini') {
          conversationMessages.push({
            role: 'model',
            parts: json.candidates[0].content.parts,
          });
        } else {
          conversationMessages.push(json.choices[0].message);
        }

        // Execute each tool call
        for (const tc of parsed.toolCalls) {
          sendEvent('tool_call', {
            id: tc.id,
            name: tc.name,
            args: tc.args,
          });

          const { result, fileChange } = await executeTool(tc.name, tc.args, projectRoot);

          sendEvent('tool_result', {
            id: tc.id,
            name: tc.name,
            result: result.slice(0, 2000), // truncate for SSE display
          });

          if (fileChange) {
            sendEvent('file_change', fileChange);
          }

          // Add tool result to conversation
          const toolMsg = adapter.buildToolResult(tc.id, tc.name, result);
          conversationMessages.push(toolMsg);
        }

        // Continue the loop — the AI will see the tool results
        continue;
      }

      // No tool calls — final text response
      if (parsed.text) {
        sendEvent('content', { text: parsed.text });
      }
      break;
    }

    if (iteration >= maxIterations) {
      sendEvent('content', { text: '\n\n⚠️ Se alcanzó el límite de iteraciones del agente.' });
    }
  } catch (e: any) {
    sendEvent('error', { message: `Agent error: ${e.message}` });
  } finally {
    sendEvent('done', {});
    res.end();
  }
});
