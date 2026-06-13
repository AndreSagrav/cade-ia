import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { join, resolve, dirname } from 'path';
import { config } from '../config';
import { getUserApiKeys } from '../lib/supabase';
export const agentRouter = Router();
// ═══════════════════════════════════════
// Tool definitions (JSON schema format)
// ═══════════════════════════════════════
const TOOL_DEFS = [
    {
        name: 'read_file',
        description: 'Read the full contents of a file from the project. Use this when you need to see what a file contains before answering or making changes.',
        parameters: {
            type: 'object',
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
            type: 'object',
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
            type: 'object',
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
            type: 'object',
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
            type: 'object',
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
            type: 'object',
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
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'git_commit_push',
        description: 'Stage all changes, commit with a message, and push to the remote repository automatically. If a GitHub token is provided in the request, it will be used for authentication.',
        parameters: {
            type: 'object',
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
            type: 'object',
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
            type: 'object',
            properties: {},
            required: [],
        },
    },
];
// ═══════════════════════════════════════
// Tool execution
// ═══════════════════════════════════════
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv']);
const backgroundTasks = new Map();
function safePath(root, rel) {
    const full = resolve(root, rel);
    if (!full.startsWith(resolve(root)))
        return null;
    return full;
}
async function executeTool(name, args, projectRoot) {
    try {
        switch (name) {
            case 'read_file': {
                const p = safePath(projectRoot, args.path);
                if (!p)
                    return { result: 'Error: ruta no permitida (path traversal)' };
                const cacheKey = p;
                const cached = global.__codeai_read_cache__;
                if (cached?.has(cacheKey)) {
                    return { result: cached.get(cacheKey) };
                }
                // 1. Revisa primero los archivos abiertos en memoria (IDE frontend)
                const openFiles = global.__codeai_open_files__ || [];
                const targetPath = args.path.replace(/\\/g, '/');
                const openFile = openFiles.find((f) => {
                    const fp = f.path.replace(/\\/g, '/');
                    return fp === targetPath || fp.endsWith('/' + targetPath);
                });
                let content;
                if (openFile) {
                    content = openFile.content;
                }
                else {
                    // 2. Si no está en memoria, lee del disco
                    if (!existsSync(p))
                        return { result: `Error: archivo no encontrado: ${args.path}` };
                    content = readFileSync(p, 'utf-8');
                }
                // Cap at 60k chars to avoid token overflow
                if (content.length > 60000) {
                    content = content.slice(0, 60000) + '\n\n... (truncado, archivo muy grande)';
                }
                // Cache the result
                if (cached)
                    cached.set(cacheKey, content);
                return { result: content };
            }
            case 'write_file': {
                const p = safePath(projectRoot, args.path);
                if (!p)
                    return { result: 'Error: ruta no permitida' };
                const dir = dirname(p);
                if (!existsSync(dir))
                    mkdirSync(dir, { recursive: true });
                let oldContent;
                if (existsSync(p)) {
                    oldContent = readFileSync(p, 'utf-8');
                }
                const content = args.content;
                writeFileSync(p, content, 'utf-8');
                return {
                    result: `✅ Archivo escrito: ${args.path} (${content.length} chars)`,
                    fileChange: { path: args.path, content, oldContent },
                };
            }
            case 'list_files': {
                const p = safePath(projectRoot, args.path || '.');
                if (!p)
                    return { result: 'Error: ruta no permitida' };
                if (!existsSync(p))
                    return { result: `Error: directorio no encontrado: ${args.path}` };
                const maxDepth = args.max_depth || 2;
                const tree = buildTreeCompact(p, 0, maxDepth);
                return { result: tree.join('\n') || '(directorio vacío)' };
            }
            case 'search_files': {
                const query = args.query.toLowerCase();
                const pattern = args.file_pattern;
                const results = searchInFiles(projectRoot, query, pattern);
                if (results.length === 0)
                    return { result: `No se encontraron coincidencias para "${args.query}"` };
                return { result: results.slice(0, 50).join('\n') };
            }
            case 'manage_tasks': {
                const action = args.action;
                const taskId = args.taskId;
                if (action === 'list') {
                    if (backgroundTasks.size === 0)
                        return { result: 'No hay tareas en segundo plano activas.' };
                    const list = Array.from(backgroundTasks.entries()).map(([id, t]) => `- ID: ${id} | Cmd: ${t.cmd}`).join('\n');
                    return { result: `Tareas activas:\n${list}` };
                }
                const task = backgroundTasks.get(taskId);
                if (!task)
                    return { result: `Error: No se encontró la tarea ${taskId}` };
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
                const cmd = args.command;
                const isBg = !!args.background;
                const blocked = ['rm -rf /', 'format', 'del /s', 'rmdir /s'];
                if (blocked.some((b) => cmd.includes(b)))
                    return { result: 'Error: comando bloqueado por seguridad' };
                if (isBg) {
                    const taskId = Date.now().toString(36);
                    const parts = cmd.split(' ');
                    const child = spawn(parts[0], parts.slice(1), { cwd: projectRoot, shell: true });
                    const logs = [];
                    child.stdout?.on('data', (data) => {
                        logs.push(data.toString());
                        if (logs.length > 100)
                            logs.shift();
                    });
                    child.stderr?.on('data', (data) => {
                        logs.push(`[ERR] ${data.toString()}`);
                        if (logs.length > 100)
                            logs.shift();
                    });
                    child.on('exit', () => backgroundTasks.delete(taskId));
                    child.on('error', (err) => logs.push(`[SYSTEM_ERR] ${err.message}`));
                    backgroundTasks.set(taskId, { cmd, process: child, logs });
                    return { result: `✅ Comando iniciado en segundo plano. Task ID: ${taskId}. Usa la herramienta manage_tasks para ver los logs o detenerlo.` };
                }
                try {
                    const stdout = execSync(cmd, { cwd: projectRoot, timeout: 60000, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 });
                    return { result: stdout.slice(0, 10000) || '(comando ejecutado sin salida)' };
                }
                catch (e) {
                    const stderr = e.stderr?.slice(0, 5000) || e.message;
                    return { result: `Error (exit ${e.status ?? '?'}): ${stderr}` };
                }
            }
            case 'git_status': {
                try {
                    const statusOut = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
                    const branchOut = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }).trim();
                    let remoteOut = '';
                    try {
                        remoteOut = execSync('git remote -v', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 });
                    }
                    catch { /* no remote */ }
                    const changes = statusOut.trim() || 'Sin cambios pendientes';
                    return { result: `Branch: ${branchOut}\nCambios:\n${changes}\nRemotos:\n${remoteOut || 'Ninguno'}` };
                }
                catch (e) {
                    if (e.message?.includes('not a git repository') || e.stderr?.includes('not a git repository')) {
                        return { result: 'Este proyecto NO es un repositorio Git. Usa git_init_and_connect para inicializarlo.' };
                    }
                    return { result: `Error: ${e.message}` };
                }
            }
            case 'git_commit_push': {
                const msg = args.message || 'Auto-commit from CodeAI';
                try {
                    execSync('git add -A', { cwd: projectRoot, encoding: 'utf-8', timeout: 15000 });
                    const commitResult = execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: projectRoot, encoding: 'utf-8', timeout: 15000 });
                    let pushResult = '';
                    try {
                        pushResult = execSync('git push', { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });
                    }
                    catch (pushErr) {
                        pushResult = `Push falló (quizás no hay remoto configurado): ${pushErr.stderr || pushErr.message}`;
                    }
                    return { result: `✅ Commit exitoso:\n${commitResult}\nPush:\n${pushResult || 'OK'}` };
                }
                catch (e) {
                    return { result: `Error en commit: ${e.stderr || e.message}` };
                }
            }
            case 'git_init_and_connect': {
                const repoName = args.repoName;
                const desc = args.description || '';
                const isPriv = !!args.isPrivate;
                // Step 1: git init if needed
                try {
                    execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, encoding: 'utf-8' });
                }
                catch {
                    execSync('git init', { cwd: projectRoot, encoding: 'utf-8' });
                }
                // Step 2: Create GitHub repo (we need the token from the request headers)
                // The token is passed via the request context
                const ghToken = global.__codeai_github_token__;
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
                    try {
                        execSync(`git remote remove origin`, { cwd: projectRoot });
                    }
                    catch { /* no existing */ }
                    execSync(`git remote add origin ${cloneUrl}`, { cwd: projectRoot });
                    // Step 4: Initial commit and push
                    execSync('git add -A', { cwd: projectRoot });
                    try {
                        execSync('git commit -m "Initial commit from CodeAI"', { cwd: projectRoot });
                    }
                    catch { /* maybe already committed */ }
                    const authedUrl = cloneUrl.replace('https://', `https://x-access-token:${ghToken}@`);
                    try {
                        execSync(`git push ${authedUrl} HEAD`, { cwd: projectRoot, timeout: 30000 });
                    }
                    catch (pushErr) {
                        return { result: `✅ Repo creado: ${repoData.html_url}\n⚠️ Push falló: ${pushErr.stderr || pushErr.message}\nRemoto configurado como origin.` };
                    }
                    return { result: `✅ ¡Repositorio creado y conectado!\n🔗 ${repoData.html_url}\n📦 Remote: origin → ${cloneUrl}\n🚀 Primer push realizado exitosamente.` };
                }
                catch (e) {
                    return { result: `Error: ${e.message}` };
                }
            }
            case 'git_pull': {
                try {
                    const result = execSync('git pull', { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });
                    return { result: result || 'Pull completado (sin cambios nuevos)' };
                }
                catch (e) {
                    return { result: `Error en pull: ${e.stderr || e.message}` };
                }
            }
            default:
                return { result: `Error: herramienta desconocida "${name}"` };
        }
    }
    catch (e) {
        return { result: `Error ejecutando ${name}: ${e.message}` };
    }
}
function buildTreeCompact(dir, depth, maxDepth, prefix = '') {
    if (depth >= maxDepth || !existsSync(dir))
        return [];
    const out = [];
    try {
        const entries = readdirSync(dir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
            .sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory())
                return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                out.push(`${prefix}📁 ${entry.name}/`);
                out.push(...buildTreeCompact(path, depth + 1, maxDepth, prefix + '  '));
            }
            else {
                const stat = statSync(path);
                out.push(`${prefix}📄 ${entry.name} (${formatSize(stat.size)})`);
            }
        }
    }
    catch { /* ignore permission errors */ }
    return out;
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function searchInFiles(dir, query, pattern, depth = 0) {
    if (depth > 4 || !existsSync(dir))
        return [];
    const results = [];
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= 50)
                break;
            if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name))
                continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...searchInFiles(fullPath, query, pattern, depth + 1));
            }
            else {
                // Check file pattern
                if (pattern) {
                    const ext = pattern.replace('*', '');
                    if (!entry.name.endsWith(ext))
                        continue;
                }
                // Skip binary files
                const binaryExts = ['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz'];
                if (binaryExts.some((e) => entry.name.endsWith(e)))
                    continue;
                try {
                    const content = readFileSync(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length && results.length < 50; i++) {
                        if (lines[i].toLowerCase().includes(query)) {
                            const relPath = fullPath.replace(dir.length === fullPath.length ? dir : dir + (dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'), '').replace(/\\/g, '/');
                            results.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
                        }
                    }
                }
                catch { /* skip unreadable */ }
            }
        }
    }
    catch { /* ignore permission errors */ }
    return results;
}
/** OpenAI-compatible adapter (OpenAI, DeepSeek, NVIDIA, OpenRouter) */
function openaiAdapter(endpoint, extra) {
    return {
        buildBody(model, messages, system) {
            const formattedMessages = messages.map((m) => {
                if (m.attachments && m.attachments.length > 0) {
                    const content = [{ type: 'text', text: m.content || '' }];
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
            if (!msg)
                return {};
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                return {
                    text: msg.content || undefined,
                    toolCalls: msg.tool_calls.map((tc) => {
                        let parsedArgs = {};
                        try {
                            parsedArgs = JSON.parse(tc.function.arguments || '{}');
                        }
                        catch (e) {
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
const claudeAdapter = {
    buildBody(model, messages, system) {
        const formattedMessages = messages.filter((m) => m.role !== 'system').map((m) => {
            if (m.attachments && m.attachments.length > 0) {
                const content = [{ type: 'text', text: m.content || '' }];
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
        if (!content || !Array.isArray(content))
            return {};
        const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        const toolUses = content.filter((b) => b.type === 'tool_use');
        if (toolUses.length > 0) {
            return {
                text: text || undefined,
                toolCalls: toolUses.map((tc) => ({
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
const geminiAdapter = {
    buildBody(model, messages, system) {
        void model; // model is used in the URL
        return {
            contents: messages.map((m) => {
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
        if (!parts)
            return {};
        const textParts = parts.filter((p) => p.text);
        const functionCalls = parts.filter((p) => p.functionCall);
        if (functionCalls.length > 0) {
            return {
                text: textParts.map((p) => p.text).join('') || undefined,
                toolCalls: functionCalls.map((p, i) => ({
                    id: `gemini-${Date.now()}-${i}`,
                    name: p.functionCall.name,
                    args: p.functionCall.args || {},
                })),
            };
        }
        return { text: textParts.map((p) => p.text).join('') };
    },
    buildToolResult(_toolCallId, toolName, result) {
        return {
            role: 'function',
            parts: [{ functionResponse: { name: toolName, response: { result } } }],
        };
    },
};
function getAdapter(provider) {
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
function getFallbackModels(provider, currentModel) {
    const fallbacks = {
        claude: {
            'claude-sonnet-4-20250514': ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
            'claude-3-5-sonnet-20241022': ['claude-3-haiku-20240307'],
            'claude-3-haiku-20240307': [],
        },
        openai: {
            'gpt-4o': ['gpt-4o-mini', 'gpt-3.5-turbo'],
            'gpt-4o-mini': ['gpt-3.5-turbo'],
            'gpt-3.5-turbo': [],
        },
        deepseek: {
            'deepseek-chat': ['deepseek-coder'],
            'deepseek-coder': [],
        },
        nvidia: {
            'meta/llama-3.1-405b-instruct': ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'],
            'meta/llama-3.1-70b-instruct': ['meta/llama-3.1-8b-instruct'],
            'meta/llama-3.1-8b-instruct': [],
        },
        openrouter: {
            'anthropic/claude-sonnet-4': ['anthropic/claude-3-haiku', 'openai/gpt-4o-mini'],
            'anthropic/claude-3-haiku': ['openai/gpt-4o-mini'],
            'openai/gpt-4o-mini': [],
        },
        gemini: {
            'gemini-2.0-flash-exp': ['gemini-1.5-flash', 'gemini-1.5-pro'],
            'gemini-1.5-flash': ['gemini-1.5-pro'],
            'gemini-1.5-pro': [],
        },
    };
    return fallbacks[provider]?.[currentModel] || [];
}
async function resolveApiKey(provider, req, clientKey) {
    if (clientKey && clientKey.trim())
        return clientKey;
    // 1) Server env fallback
    const envKey = (provider === 'claude' ? config.anthropicApiKey :
        provider === 'openai' ? config.openaiApiKey :
            provider === 'deepseek' ? config.deepseekApiKey :
                provider === 'nvidia' ? config.nvidiaApiKey :
                    provider === 'openrouter' ? config.openrouterApiKey :
                        provider === 'gemini' ? config.geminiApiKey : '');
    if (envKey)
        return envKey;
    // 2) Supabase per-user fallback (requires SUPABASE_URL + SERVICE_ROLE key and x-auth-user)
    const username = req.headers['x-auth-user'] || '';
    if (!username)
        return '';
    const map = await getUserApiKeys(username);
    const byProvider = {
        claude: map.claude,
        openai: map.openai,
        gemini: map.gemini,
        deepseek: map.deepseek,
        nvidia: map.nvidia,
        openrouter: map.openrouter,
    };
    return (byProvider[provider] || '');
}
// ═══════════════════════════════════════
// Agent loop endpoint
// ═══════════════════════════════════════
agentRouter.post('/', async (req, res) => {
    const { messages, model, provider, system, projectRoot, maxIterations = 1000, githubToken, openFiles } = req.body;
    // Store GitHub token and open files for tools
    if (githubToken)
        global.__codeai_github_token__ = githubToken;
    if (openFiles)
        global.__codeai_open_files__ = openFiles;
    if (!messages || !model || !provider || !projectRoot) {
        return res.status(400).json({ error: 'Missing required fields: messages, model, provider, projectRoot' });
    }
    // Resolve API key from headers or server config
    const clientKey = req.headers['x-api-key']
        || req.headers['authorization']?.replace('Bearer ', '')
        || req.body.apiKey
        || '';
    const apiKey = await resolveApiKey(provider, req, clientKey || undefined);
    if (!apiKey) {
        return res.status(401).json({ error: `No API key configured for provider: ${provider}` });
    }
    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const adapter = getAdapter(provider);
    let conversationMessages = [...messages];
    let iteration = 0;
    const readCache = new Map();
    global.__codeai_read_cache__ = readCache;
    let currentModel = model;
    let fallbackIndex = 0;
    const fallbackModels = getFallbackModels(provider, model);
    try {
        while (iteration < maxIterations) {
            iteration++;
            // Build base body without stream property
            const baseBody = adapter.buildBody(currentModel, conversationMessages, system || '');
            // Gemini's stream endpoint does not want {stream: true} in the body.
            const body = provider === 'gemini' ? baseBody : { ...baseBody, stream: true };
            const endpoint = adapter.getEndpoint(currentModel);
            const headers = adapter.getHeaders(apiKey);
            // For Gemini, use streamGenerateContent instead of generateContent
            const url = provider === 'gemini'
                ? `${endpoint.replace('generateContent', 'streamGenerateContent')}?key=${apiKey}&alt=sse`
                : endpoint;
            const fetchHeaders = provider === 'gemini'
                ? { 'Content-Type': 'application/json' }
                : headers;
            sendEvent('status', { type: 'thinking', iteration });
            let fetchResponse = null;
            let lastError = '';
            let tries = 0;
            const maxTries = 5;
            while (tries < maxTries) {
                fetchResponse = await fetch(url, {
                    method: 'POST',
                    headers: fetchHeaders,
                    body: JSON.stringify(body),
                });
                if (fetchResponse.ok)
                    break;
                lastError = await fetchResponse.text();
                if (fetchResponse.status === 429 || fetchResponse.status >= 500) {
                    tries++;
                    if (tries < maxTries) {
                        const backoff = 1000 * Math.pow(2, tries - 1) + Math.floor(Math.random() * 500);
                        sendEvent('status', { type: 'retrying', iteration, message: `Rate limit (${fetchResponse.status}), reintentando en ${Math.round(backoff / 1000)}s...` });
                        await new Promise(r => setTimeout(r, backoff));
                        continue;
                    }
                }
                break;
            }
            if (!fetchResponse || !fetchResponse.ok) {
                if (fetchResponse?.status === 429 && fallbackIndex < fallbackModels.length) {
                    currentModel = fallbackModels[fallbackIndex];
                    fallbackIndex++;
                    sendEvent('status', { type: 'switching_model', iteration, message: `Cambiando a modelo de fallback: ${currentModel}` });
                    await new Promise(r => setTimeout(r, 500));
                    iteration--;
                    continue;
                }
                if (fetchResponse?.status === 429) {
                    sendEvent('error', { message: `Límite de tasa excedido. El sistema reintentó ${maxTries} veces y agotó los modelos de fallback. Intenta cambiar de proveedor o espera unos minutos.` });
                }
                else {
                    sendEvent('error', { message: `API error ${fetchResponse?.status ?? 'unknown'}: ${lastError.slice(0, 300)}` });
                }
                break;
            }
            const decoder = new TextDecoder();
            let buffer = '';
            let textContent = '';
            let reasoningContent = '';
            let hasReasoning = false;
            const toolCallsMap = new Map();
            if (fetchResponse.body) {
                for await (const chunk of fetchResponse.body) {
                    buffer += decoder.decode(chunk, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: '))
                            continue;
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]')
                            continue;
                        try {
                            const json = JSON.parse(dataStr);
                            // OpenAI / DeepSeek format
                            if (json.choices?.[0]?.delta) {
                                const delta = json.choices[0].delta;
                                if (delta.content) {
                                    textContent += delta.content;
                                    sendEvent('content', { text: delta.content });
                                }
                                if (delta.reasoning_content) {
                                    reasoningContent += delta.reasoning_content;
                                    if (!hasReasoning) {
                                        hasReasoning = true;
                                        // Send this only ONCE so we don't spam the UI
                                        sendEvent('status', { type: 'thinking', iteration });
                                    }
                                    // Keep connection alive without spamming the UI
                                    sendEvent('ping', {});
                                }
                                if (delta.tool_calls) {
                                    for (const tc of delta.tool_calls) {
                                        if (!toolCallsMap.has(tc.index)) {
                                            toolCallsMap.set(tc.index, { id: tc.id, name: tc.function?.name, args: tc.function?.arguments || '' });
                                        }
                                        else {
                                            const existing = toolCallsMap.get(tc.index);
                                            if (tc.function?.arguments)
                                                existing.args += tc.function.arguments;
                                        }
                                    }
                                }
                            }
                            // Claude format
                            else if (json.type === 'content_block_delta' && json.delta?.text) {
                                textContent += json.delta.text;
                                sendEvent('content', { text: json.delta.text });
                            }
                            else if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
                                toolCallsMap.set(json.index, { id: json.content_block.id, name: json.content_block.name, args: '' });
                            }
                            else if (json.type === 'content_block_delta' && json.delta?.type === 'input_json_delta') {
                                const existing = toolCallsMap.get(json.index);
                                if (existing)
                                    existing.args += json.delta.partial_json;
                            }
                            // Gemini format (array of candidates)
                            else if (json.candidates?.[0]?.content?.parts) {
                                const parts = json.candidates[0].content.parts;
                                for (const p of parts) {
                                    if (p.text) {
                                        textContent += p.text;
                                        sendEvent('content', { text: p.text });
                                    }
                                    if (p.functionCall) {
                                        toolCallsMap.set(toolCallsMap.size, {
                                            id: `gemini-${Date.now()}-${toolCallsMap.size}`,
                                            name: p.functionCall.name,
                                            args: typeof p.functionCall.args === 'string' ? p.functionCall.args : JSON.stringify(p.functionCall.args)
                                        });
                                    }
                                }
                            }
                        }
                        catch (e) {
                            // skip invalid JSON
                        }
                    }
                }
            }
            const parsedToolCalls = Array.from(toolCallsMap.values()).map(tc => {
                let parsedArgs = {};
                try {
                    parsedArgs = typeof tc.args === 'string' ? JSON.parse(tc.args || '{}') : tc.args;
                }
                catch (e) {
                    parsedArgs = { _error: 'JSON parse error: ' + tc.args };
                }
                return { id: tc.id, name: tc.name, args: parsedArgs };
            });
            // If there are tool calls, execute them
            if (parsedToolCalls.length > 0) {
                // Add the assistant message to conversation (with tool calls)
                const toolMsgPayload = { role: 'assistant', content: textContent || '' };
                if (reasoningContent)
                    toolMsgPayload.reasoning_content = reasoningContent;
                if (provider === 'claude') {
                    toolMsgPayload.content = textContent ? [{ type: 'text', text: textContent }] : [];
                    parsedToolCalls.forEach(tc => {
                        toolMsgPayload.content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
                    });
                }
                else if (provider === 'gemini') {
                    toolMsgPayload.role = 'model';
                    toolMsgPayload.parts = textContent ? [{ text: textContent }] : [];
                    parsedToolCalls.forEach(tc => {
                        toolMsgPayload.parts.push({ functionCall: { name: tc.name, args: tc.args } });
                    });
                }
                else {
                    toolMsgPayload.tool_calls = parsedToolCalls.map(tc => ({
                        id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args) }
                    }));
                }
                conversationMessages.push(toolMsgPayload);
                // Self-healing: track retries per tool call
                const MAX_TOOL_RETRIES = 2;
                const retryCounts = new Map();
                function isErrorResult(result) {
                    const lower = result.toLowerCase();
                    return lower.includes('error') || lower.includes('falló') || lower.includes('no encontrado') || lower.includes('no se encontró') || lower.includes('not found') || lower.includes('failed') || lower.includes('permission denied') || lower.includes('does not exist') || lower.includes('is not a git repository');
                }
                // Execute each tool call
                for (const tc of parsedToolCalls) {
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
                    // Self-healing: if tool failed, inject correction prompt
                    if (isErrorResult(result)) {
                        const currentRetries = retryCounts.get(tc.id) || 0;
                        if (currentRetries < MAX_TOOL_RETRIES) {
                            retryCounts.set(tc.id, currentRetries + 1);
                            const correctionPrompt = `⚠️ El tool ${tc.name} falló con: ${result.slice(0, 300)}. Corrige tu approach y reintenta con parámetros diferentes o usa otro tool.`;
                            conversationMessages.push({ role: 'user', content: correctionPrompt });
                            sendEvent('status', { type: 'self_healing', iteration, message: `Self-healing: reintentando ${tc.name} (${currentRetries + 1}/${MAX_TOOL_RETRIES})` });
                        }
                        else {
                            sendEvent('status', { type: 'self_healing_failed', iteration, message: `${tc.name} agotó reintentos.` });
                        }
                    }
                }
                // Continue the loop — the AI will see the tool results
                continue;
            }
            // No tool calls — stream finished successfully
            break;
        }
        if (iteration >= maxIterations) {
            sendEvent('content', { text: '\n\n⚠️ Se alcanzó el límite de iteraciones del agente.' });
        }
    }
    catch (e) {
        sendEvent('error', { message: `Agent error: ${e.message}` });
    }
    finally {
        sendEvent('done', {});
        res.end();
    }
});
