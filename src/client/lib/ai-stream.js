import { api } from './api';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { processAgentResponse } from './agent';
import { getLanguageFromPath } from './utils';
/** Flatten file tree into a compact path list */
function flattenTree(entries, prefix = '') {
    const out = [];
    for (const e of entries ?? []) {
        const name = e.name ?? e.path?.split('/').pop() ?? '';
        if (!name)
            continue;
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build')
            continue;
        const full = prefix ? `${prefix}/${name}` : name;
        if (e.kind === 'directory' || e.children) {
            out.push(`${full}/`);
            if (e.children)
                out.push(...flattenTree(e.children, full));
        }
        else {
            out.push(full);
        }
    }
    return out;
}
/** Build the system prompt with project context */
function buildSystemPrompt() {
    const editorState = useEditorStore.getState();
    const { rootPath, contextFiles, openFiles, fileTree, activeFilePath } = editorState;
    const agentMode = useChatStore.getState().agentMode;
    let system = `Eres CodeAI, un ingeniero de software senior operando DENTRO de este IDE. Respondes en español.

OBJETIVO PRINCIPAL:
- Entregar soluciones correctas, concisas y accionables que funcionen en este proyecto sin pasos manuales innecesarios.

ESTILO DE COMUNICACIÓN (MODO SILENCIOSO):
- Sé directo y profesional. Cero relleno y CERO trazas de herramientas.
- Muestra solo un Plan breve (3-5 pasos) y el resultado/diff. Nada de “read_file”, “search_files” ni comandos intermedios.
- Si falta información crítica, pide 1-2 datos concretos.

POLÍTICA DE CÓDIGO:
- Cambios mínimos y seguros. Mantén imports correctos, tipado estricto y estilo del repo.
- Cuando edites archivos, entrega contenido completo y coherente. No dejes TODOs.
- Si el cambio es grande, divídelo por archivos en respuestas separadas.

PROTOCOLO DE ACCIONES (EJECUTABLE POR ESTE IDE):
- Para EDITAR archivos, devuelve bloques de código con este formato exacto (uno o varios por respuesta):
  \`\`\`ts file:relative/path.ext
  <contenido COMPLETO del archivo>
  \`\`\`
- Para EJECUTAR un comando puntual (corto), devuelve:
  \`\`\`run
  <comando>
  \`\`\`
- No utilices JSON de herramientas (p. ej., read_file/write_file). No imprimas trazas de herramientas.
- Cada respuesta debe ser ACCIONABLE: si el usuario pidió un cambio, incluye al menos un bloque file: o run.

EFICIENCIA Y CONTEXTO:
- Lee lo mínimo indispensable a partir del árbol y archivos abiertos que te doy.
- Evita repeticiones y evita listar o leer archivos irrelevantes.

ROBUSTEZ:
- Si falla la generación, intenta de nuevo con salida más corta.
- Si un archivo no existe, trátalo como nuevo.

CRITERIOS DE SALIDA Y VALIDACIÓN:
- Define "done" por iteración: archivo X modificado/aportado y verificado (re-lectura).
- Tras cambios críticos, sugiere validación rápida (build/lint/test) si aplica.

FORMATO DE SALIDA:
- Empieza con un Plan breve (3-5 pasos). Luego el resultado y los bloques file:/run accionables. Nada más.
`;
    if (agentMode) {
        system += `\n\nMODO AGENTE ACTIVADO — Aplica cambios con bloques file: y valida con pasos mínimos. Evita instrucciones manuales.`;
    }
    else {
        system += `\nCuando muestres código, usa solo los fragmentos necesarios con el lenguaje correcto.`;
    }
    if (rootPath) {
        system += `\n\nProyecto abierto en: ${rootPath}`;
    }
    // Project tree (compact, top 200 entries)
    if (fileTree && fileTree.length > 0) {
        const paths = flattenTree(fileTree).slice(0, 200);
        if (paths.length > 0) {
            system += `\n\n--- ÁRBOL DEL PROYECTO ---\n${paths.join('\n')}`;
        }
    }
    // Include open files in context (for both modes)
    const filesToInclude = new Set();
    if (agentMode) {
        if (activeFilePath)
            filesToInclude.add(activeFilePath);
        for (const p of openFiles.keys())
            filesToInclude.add(p);
    }
    for (const p of contextFiles)
        filesToInclude.add(p);
    if (filesToInclude.size > 0) {
        system += '\n\n--- ARCHIVOS EN CONTEXTO ---';
        let total = 0;
        const BUDGET = 40000;
        for (const path of filesToInclude) {
            if (total >= BUDGET)
                break;
            const file = openFiles.get(path);
            if (file) {
                const slice = file.content.slice(0, Math.min(8000, BUDGET - total));
                system += `\n\n### ${path}\n\`\`\`\n${slice}\n\`\`\``;
                total += slice.length;
            }
        }
    }
    return system;
}
/** Get route and headers for a given provider */
function getProviderConfig(provider, apiKeys) {
    const useUnified = window.__AI_UNIFIED__ === true;
    if (useUnified) {
        switch (provider) {
            case 'claude':
                return { path: '/api/ai-unified/chat', headers: { 'x-api-key': apiKeys.claude || '' } };
            case 'openai':
                return { path: '/api/ai-unified/chat', headers: { 'Authorization': `Bearer ${apiKeys.openai || ''}` } };
            case 'gemini':
                return { path: '/api/ai-unified/chat', headers: {} };
            case 'deepseek':
                return { path: '/api/ai-unified/chat', headers: { 'Authorization': `Bearer ${apiKeys.deepseek || ''}` } };
            case 'nvidia':
                return { path: '/api/ai-unified/chat', headers: { 'Authorization': `Bearer ${apiKeys.nvidia || ''}` } };
            case 'openrouter':
                return { path: '/api/ai-unified/chat', headers: { 'Authorization': `Bearer ${apiKeys.openrouter || ''}` } };
            default:
                return { path: '/api/ai-unified/chat', headers: {} };
        }
    }
    switch (provider) {
        case 'claude':
            return { path: '/api/ai/claude', headers: { 'x-api-key': apiKeys.claude || '' } };
        case 'openai':
            return { path: '/api/ai/openai', headers: { 'Authorization': `Bearer ${apiKeys.openai || ''}` } };
        case 'gemini':
            return { path: '/api/ai/gemini', headers: {} };
        case 'deepseek':
            return { path: '/api/ai/deepseek', headers: { 'Authorization': `Bearer ${apiKeys.deepseek || ''}` } };
        case 'nvidia':
            return { path: '/api/ai/nvidia', headers: { 'Authorization': `Bearer ${apiKeys.nvidia || ''}` } };
        case 'openrouter':
            return { path: '/api/ai/openrouter', headers: { 'Authorization': `Bearer ${apiKeys.openrouter || ''}` } };
        default:
            return { path: '/api/ai/openai', headers: {} };
    }
}
/** Build request body for each provider (non-agent mode) */
function buildRequestBody(provider, modelId, messages, system) {
    const model = AI_MODELS[modelId];
    const apiModelId = model?.apiModelId ?? modelId;
    switch (provider) {
        case 'claude':
            return {
                model: apiModelId,
                max_tokens: model?.maxTokens ?? 4096,
                system,
                messages: messages.filter((m) => m.role !== 'system'),
                stream: true,
            };
        case 'gemini':
            return {
                apiKey: useSettingsStore.getState().apiKeys.gemini,
                model: apiModelId,
                body: {
                    contents: messages.map((m) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }],
                    })),
                    systemInstruction: { parts: [{ text: system }] },
                },
            };
        case 'openai':
        case 'deepseek':
        case 'nvidia':
        case 'openrouter':
        default:
            return {
                model: apiModelId,
                messages: [{ role: 'system', content: system }, ...messages],
                max_tokens: model?.maxTokens ?? 4096,
                stream: true,
            };
    }
}
function detectTask(userMessage, historyLength, agentMode) {
    const lower = userMessage.toLowerCase();
    const approxTokens = historyLength / 4;
    // Detect task type
    const codeKeywords = ['función', 'funcion', 'class', 'import', 'export', 'component', 'api', 'endpoint', 'bug', 'error', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'html', 'css', 'react', 'código', 'codigo', 'archivo', 'file', 'crea', 'modifica', 'implementa', 'programa', 'script', 'variable', 'array', 'objeto', 'loop', 'for', 'while', 'if', 'else', 'return', 'async', 'await', 'promise', 'fetch', 'database', 'sql', 'query', 'schema', 'migration', 'deploy', 'build', 'compile', 'test', 'jest', 'npm', 'yarn', 'git'];
    const reasoningKeywords = ['explica', 'por qué', 'porqué', 'analiza', 'compara', 'evalúa', 'evalua', 'piensa', 'razona', 'arquitectura', 'diseño', 'patrón', 'patron', 'trade-off', 'ventajas', 'desventajas', 'pros', 'cons', 'mejor', 'peor', 'opción', 'opcion', 'estrategia', 'plan', 'optimiza'];
    const codeScore = codeKeywords.filter(k => lower.includes(k)).length;
    const reasoningScore = reasoningKeywords.filter(k => lower.includes(k)).length;
    let type = 'general';
    if (codeScore > reasoningScore && codeScore >= 2)
        type = 'code';
    else if (reasoningScore > codeScore && reasoningScore >= 2)
        type = 'reasoning';
    else if (codeScore >= 1)
        type = 'code'; // bias toward code in an IDE
    // Detect complexity
    let complexity = 'light';
    if (agentMode || approxTokens > 6000 || lower.length > 500) {
        complexity = 'heavy';
    }
    else if (approxTokens > 2000 || lower.length > 200 || codeScore >= 3 || reasoningScore >= 2) {
        complexity = 'medium';
    }
    return { complexity, type, approxTokens };
}
/** Check if a model is available (has API key or is free) */
function isModelAvailable(modelId, apiKeys) {
    const model = AI_MODELS[modelId];
    if (!model)
        return false;
    // Free-tier providers don't need API keys
    const freeProviders = ['nvidia', 'openrouter'];
    if (freeProviders.includes(model.provider))
        return true;
    // Gemini free-tier models don't need keys (they use AI Studio)
    if (model.provider === 'gemini' && model.tier === 'free')
        return true;
    // Paid providers need API keys
    const key = apiKeys[model.provider];
    return !!key && key.trim().length > 0;
}
/** Check if a model is within its daily limit */
function isWithinLimit(modelId, modelUsage) {
    const model = AI_MODELS[modelId];
    if (!model || !model.dailyLimit || model.dailyLimit.value === 0)
        return true; // paid = no free limit but still usable
    const today = new Date().toISOString().split('T')[0];
    const usage = modelUsage[modelId];
    if (!usage || usage.date !== today)
        return true; // no usage today = within limit
    const dl = model.dailyLimit;
    if (dl.type === 'requests') {
        return (usage.requests ?? 0) < dl.value;
    }
    else {
        return usage.tokens < dl.value;
    }
}
/** Get usage percentage for a model (0-100) */
function getUsagePercent(modelId, modelUsage) {
    const model = AI_MODELS[modelId];
    if (!model?.dailyLimit || model.dailyLimit.value === 0)
        return 0;
    const today = new Date().toISOString().split('T')[0];
    const usage = modelUsage[modelId];
    if (!usage || usage.date !== today)
        return 0;
    const dl = model.dailyLimit;
    const consumed = dl.type === 'requests' ? (usage.requests ?? 0) : usage.tokens;
    return Math.min(100, Math.round((consumed / dl.value) * 100));
}
/** Rank score: higher = better quality */
function getModelQualityScore(modelId) {
    const id = modelId.toLowerCase();
    // S-tier
    if (id.includes('claude-opus') || id.includes('gemini-3.5') || id.includes('qwen3-coder-480b'))
        return 100;
    if (id.includes('claude-sonnet') || id.includes('deepseek-v4-pro'))
        return 95;
    // A-tier
    if (id.includes('deepseek-v4-flash') || id.includes('gemini-2.5-pro') || id.includes('gemini-2.5-flash') || id.includes('codestral') || id.includes('mistral-small') || id.includes('mistral-medium'))
        return 80;
    // B-tier  
    if (id.includes('qwen') || id.includes('nemotron') || id.includes('deepseek-v3') || id.includes('deepseek-r1') || id.includes('gpt-oss') || id.includes('glm') || id.includes('kimi') || id.includes('minimax') || id.includes('gemma') || id.includes('seed') || id.includes('step'))
        return 60;
    // C-tier
    if (id.includes('llama') || id.includes('flash-lite'))
        return 40;
    return 50;
}
/** The main adaptive selection algorithm */
function adaptiveSelectModel(userMessage, historyText, agentMode) {
    const chatStore = useChatStore.getState();
    const settingsStore = useSettingsStore.getState();
    const apiKeys = settingsStore.apiKeys;
    const { modelUsage } = chatStore;
    const { complexity, type, approxTokens } = detectTask(userMessage, historyText.length, agentMode);
    // Build candidate list: all models that are available and within limits
    const candidates = Object.values(AI_MODELS)
        .filter(m => isModelAvailable(m.id, apiKeys))
        .filter(m => isWithinLimit(m.id, modelUsage));
    if (candidates.length === 0) {
        return { modelId: 'gemini-2.5-flash', reason: 'Fallback — sin modelos disponibles con cuota', approxTokens };
    }
    // Score each candidate
    const scored = candidates.map(m => {
        let score = getModelQualityScore(m.id);
        const usagePct = getUsagePercent(m.id, modelUsage);
        // Prefer less-used models (save quota)
        score -= usagePct * 0.3;
        // Prefer free models over paid
        if (m.tier === 'free')
            score += 15;
        else if (m.tier === 'paid')
            score -= 20;
        else if (m.tier === 'premium')
            score -= 40;
        // Capability matching
        if (type === 'code' && m.capabilities.includes('code'))
            score += 10;
        if (type === 'reasoning' && m.capabilities.includes('reasoning'))
            score += 10;
        // Context window: penalize if conversation might not fit
        if (approxTokens > m.contextWindow * 0.5)
            score -= 30;
        // For heavy tasks, boost high-quality models
        if (complexity === 'heavy') {
            score += getModelQualityScore(m.id) * 0.3;
        }
        // For light tasks, boost cheap/fast models
        if (complexity === 'light') {
            if (m.tier === 'free')
                score += 20;
            if (m.id.includes('flash') || m.id.includes('lite') || m.id.includes('8b') || m.id.includes('nano'))
                score += 15;
        }
        return { model: m, score };
    });
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const tierLabel = best.model.tier === 'free' ? 'gratis' : best.model.tier;
    const complexityLabel = complexity === 'heavy' ? 'compleja' : complexity === 'medium' ? 'moderada' : 'simple';
    const typeLabel = type === 'code' ? 'código' : type === 'reasoning' ? 'razonamiento' : 'general';
    const reason = `Tarea ${complexityLabel} (${typeLabel}) · ${tierLabel} · ~${Math.round(approxTokens)} tok · ${Math.round(best.score)} pts`;
    return { modelId: best.model.id, reason, approxTokens };
}
// ═══════════════════════════════════════
// Agent mode: stream via agentic loop
// ═══════════════════════════════════════
async function streamAgentChat() {
    const chatStore = useChatStore.getState();
    const settingsStore = useSettingsStore.getState();
    const editorState = useEditorStore.getState();
    const { selectedModel, sessions, activeSessionId } = chatStore;
    const system = buildSystemPrompt();
    let actualModelId = selectedModel;
    let model = AI_MODELS[actualModelId];
    if (selectedModel === 'adaptive') {
        const session = sessions.find((s) => s.id === activeSessionId);
        const historyText = (session?.messages ?? []).slice(-10).map((m) => m.content).join('\n');
        const lastUserMsg = (session?.messages ?? []).filter((m) => m.role === 'user').pop()?.content ?? '';
        const result = adaptiveSelectModel(lastUserMsg, historyText + system, chatStore.agentMode);
        actualModelId = result.modelId;
        model = AI_MODELS[actualModelId];
        chatStore.addMessage({
            id: Date.now().toString(36),
            role: 'assistant',
            content: `🔀 **Adaptive →** ${model.label} *(${AI_MODELS[actualModelId].provider})* — ${result.reason}`,
            timestamp: Date.now(),
            model: actualModelId
        });
    }
    if (!model) {
        chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: 'Error: modelo no encontrado.', timestamp: Date.now() });
        return;
    }
    const apiKeys = settingsStore.apiKeys;
    const apiModelId = model.apiModelId;
    // Build messages
    const session = sessions.find((s) => s.id === activeSessionId);
    const historyMessages = (session?.messages ?? [])
        .filter((m) => m.role !== 'system')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments, reasoning_content: m.reasoning_content }));
    // Determine which API key to send
    const providerKey = apiKeys[model.provider] || '';
    // Resolve active GitHub token
    const settingsState = useSettingsStore.getState();
    const githubAccounts = settingsState.githubAccounts || [];
    const activeGithubAccount = settingsState.activeGithubAccount;
    const activeAccount = githubAccounts.find((a) => a.username === activeGithubAccount) || githubAccounts[0];
    const body = {
        messages: historyMessages,
        model: apiModelId,
        provider: model.provider,
        system,
        projectRoot: editorState.rootPath || '',
        apiKey: providerKey,
        maxIterations: 1000,
        githubToken: activeAccount?.token || '',
        openFiles: Array.from(editorState.openFiles.entries()).map(([path, f]) => ({
            path: path.replace(/\\/g, '/'),
            content: f.content
        })),
    };
    chatStore.setStreaming(true);
    chatStore.setStreamContent('');
    const toolCalls = [];
    const agentChanges = [];
    let fullContent = '';
    try {
        // Increment requests immediately so it counts even if it 504s
        chatStore.incrementModelRequests(actualModelId);
        const wapi = (typeof window !== 'undefined' ? window.api : null);
        const useIpc = !!(wapi && wapi.ai && wapi.ai.start);
        if (useIpc) {
            const session = await wapi.ai.start({
                provider: model.provider,
                model: apiModelId,
                system,
                messages: historyMessages,
                apiKey: (useSettingsStore.getState().apiKeys || {})[model.provider] || useSettingsStore.getState().apiKeys?.openrouter || '',
                username: (typeof window !== 'undefined' ? localStorage.getItem('codeai-user') : '') || ''
            });
            if (session?.error)
                throw new Error(session.error);
            const sessionId = session.sessionId;
            const ctrl = new AbortController();
            ctrl.signal.addEventListener('abort', () => wapi.ai.abort(sessionId));
            chatStore.setAbortController(ctrl);
            let lastBeat = Date.now();
            let retried = false;
            const stopChunk = wapi.ai.onChunk(sessionId, (text) => {
                fullContent += text;
                chatStore.setStreamContent(fullContent);
                lastBeat = Date.now();
            });
            const stopError = wapi.ai.onError(sessionId, (err) => {
                chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: `Error: ${err}`, timestamp: Date.now(), model: selectedModel });
            });
            const stopHb = wapi.ai.onHeartbeat(sessionId, () => { lastBeat = Date.now(); });
            const stallTimer = setInterval(async () => {
                if (Date.now() - lastBeat > 6000 && !retried) {
                    retried = true;
                    try {
                        ctrl.abort();
                    }
                    catch { }
                    clearInterval(stallTimer);
                    chatStore.setStreaming(false);
                    chatStore.setStreamContent('');
                    await streamAgentChat();
                }
            }, 1500);
            await new Promise((resolve) => {
                const stopDone = wapi.ai.onDone(sessionId, () => { stopChunk(); stopError(); stopHb(); clearInterval(stallTimer); stopDone(); resolve(); });
            });
        }
        else {
            const authToken = (typeof window !== 'undefined' ? localStorage.getItem('codeai-auth') : '') || '';
            const authUser = (typeof window !== 'undefined' ? localStorage.getItem('codeai-user') : '') || '';
            const { response, abort } = api.streamAgent(body, {
                'x-auth-token': authToken,
                'x-auth-user': authUser,
            });
            const ctrl = new AbortController();
            ctrl.signal.addEventListener('abort', () => abort());
            chatStore.setAbortController(ctrl);
            const res = await response;
            if (!res.ok) {
                const errText = await res.text();
                chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: `Error ${res.status}: ${errText.slice(0, 200)}`, timestamp: Date.now(), model: selectedModel, });
                chatStore.setStreaming(false);
                return;
            }
            const reader = res.body?.getReader();
            if (!reader)
                throw new Error('No response body');
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: '))
                        currentEvent = line.slice(7).trim();
                    else if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        try {
                            const data = JSON.parse(dataStr);
                            handleAgentEvent(currentEvent, data, toolCalls, agentChanges, (text) => {
                                fullContent += text;
                                chatStore.setStreamContent(fullContent);
                            });
                        }
                        catch { }
                    }
                }
            }
        }
        // Build the final assistant message with tool call info
        let finalContent = fullContent || '(sin respuesta)';
        const silent = useChatStore.getState().silentMode;
        if (!silent && toolCalls.length > 0) {
            const toolSummary = toolCalls.map((tc) => {
                const icon = tc.name === 'read_file' ? '📖' : tc.name === 'write_file' ? '✏️' : tc.name === 'list_files' ? '📁' : tc.name === 'search_files' ? '🔍' : '⚡';
                return `${icon} \`${tc.name}\`(${formatToolArgs(tc.args)})`;
            }).join('\n');
            finalContent = `**Herramientas usadas:**\n${toolSummary}\n\n---\n\n${finalContent}`;
        }
        chatStore.addMessage({
            id: Date.now().toString(36), role: 'assistant',
            content: finalContent,
            timestamp: Date.now(), model: actualModelId,
            agentChanges: agentChanges.length > 0 ? agentChanges : undefined,
        });
        const promptTokens = Math.ceil((system.length + JSON.stringify(historyMessages).length) / 4);
        const completionTokens = Math.ceil(finalContent.length / 4);
        chatStore.incrementModelUsage(actualModelId, promptTokens + completionTokens);
        // file changes are now processed natively in handleAgentEvent
    }
    catch (e) {
        if (e.name !== 'AbortError') {
            chatStore.addMessage({
                id: Date.now().toString(36), role: 'assistant',
                content: `Error: ${e.message}`,
                timestamp: Date.now(), model: selectedModel,
            });
        }
    }
    finally {
        chatStore.setStreaming(false);
        chatStore.setStreamContent('');
        chatStore.setAgentStatus(null);
        chatStore.setAbortController(null);
    }
}
function handleAgentEvent(event, data, toolCalls, agentChanges, appendContent) {
    switch (event) {
        case 'status':
            if (data.type === 'thinking') {
                useChatStore.getState().setAgentStatus('Razonando respuesta...');
            }
            break;
        case 'tool_call':
            toolCalls.push({
                id: data.id,
                name: data.name,
                args: data.args,
                status: 'running',
            });
            {
                const silent = useChatStore.getState().silentMode;
                if (!silent) {
                    const icon = data.name === 'read_file' ? '📖' : data.name === 'write_file' ? '✏️' : data.name === 'list_files' ? '📁' : data.name === 'search_files' ? '🔍' : '⚡';
                    appendContent(`${icon} Ejecutando \`${data.name}\`(${formatToolArgs(data.args)})...\n`);
                }
            }
            break;
        case 'tool_result': {
            const tc = toolCalls.find((t) => t.id === data.id);
            if (tc) {
                tc.status = 'done';
                tc.result = data.result;
            }
            {
                const silent = useChatStore.getState().silentMode;
                if (!silent)
                    appendContent(`✅ Resultado recibido\n\n`);
            }
            break;
        }
        case 'file_change': {
            const tc = toolCalls.find((t) => t.name === 'write_file' && t.status === 'done' && !t.fileChange);
            if (tc) {
                tc.fileChange = { path: data.path, content: data.content };
            }
            const editorStore = useEditorStore.getState();
            const rootPath = editorStore.rootPath;
            const autoApply = useChatStore.getState().autoApply;
            const existing = editorStore.openFiles.get(data.path);
            const originalContent = data.oldContent || '';
            agentChanges.push({
                path: data.path,
                oldContent: originalContent,
                newContent: data.content,
            });
            // Ensure file is open with original content (helps diff and UI refresh)
            if (!existing) {
                editorStore.openFile(data.path, {
                    path: data.path,
                    content: originalContent,
                    language: getLanguageFromPath(data.path),
                    modified: false,
                });
            }
            const changeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            if (autoApply && rootPath) {
                // Write directly to disk and update editor state
                (async () => {
                    try {
                        await api.writeFile({ path: data.path, content: data.content, root: rootPath });
                        // reflect accepted change in UI
                        editorStore.updateFileContent(data.path, data.content);
                        editorStore.markFileSaved(data.path);
                        editorStore.addPendingChange({
                            id: changeId,
                            type: 'replace',
                            file: data.path,
                            content: data.content,
                            original: originalContent,
                            status: 'accepted',
                        });
                    }
                    catch (e) {
                        // Fallback to preview if write fails
                        editorStore.addPendingChange({
                            id: changeId,
                            type: 'replace',
                            file: data.path,
                            content: data.content,
                            original: originalContent,
                            status: 'pending',
                        });
                        editorStore.applyPreview(data.path, originalContent, data.content, changeId);
                    }
                })();
            }
            else {
                // Preview-only path (no auto-apply or missing root)
                editorStore.addPendingChange({
                    id: changeId,
                    type: 'replace',
                    file: data.path,
                    content: data.content,
                    original: originalContent,
                    status: 'pending',
                });
                editorStore.applyPreview(data.path, originalContent, data.content, changeId);
            }
            {
                const silent = useChatStore.getState().silentMode;
                if (!silent)
                    appendContent(`📝 Archivo modificado: \`${data.path}\`\n`);
            }
            break;
        }
        case 'content':
            // Clear the "thinking" prefix and show actual content
            appendContent(data.text || '');
            break;
        case 'error':
            appendContent(`\n❌ Error: ${data.message}\n`);
            break;
        case 'done':
            // Stream complete
            break;
    }
}
function formatToolArgs(args) {
    const entries = Object.entries(args);
    if (entries.length === 0)
        return '';
    if (entries.length === 1) {
        const val = String(entries[0][1]);
        return val.length > 60 ? val.slice(0, 57) + '...' : val;
    }
    return entries.map(([k, v]) => {
        const val = String(v);
        return `${k}: ${val.length > 30 ? val.slice(0, 27) + '...' : val}`;
    }).join(', ');
}
// ═══════════════════════════════════════
// Non-agent mode: direct streaming (legacy)
// ═══════════════════════════════════════
async function streamDirectChat() {
    const chatStore = useChatStore.getState();
    const settingsStore = useSettingsStore.getState();
    const { selectedModel, sessions, activeSessionId } = chatStore;
    const system = buildSystemPrompt();
    let actualModelId = selectedModel;
    let model = AI_MODELS[actualModelId];
    if (selectedModel === 'adaptive') {
        const session = sessions.find((s) => s.id === activeSessionId);
        const historyText = (session?.messages ?? []).slice(-10).map((m) => m.content).join('\n');
        const lastUserMsg = (session?.messages ?? []).filter((m) => m.role === 'user').pop()?.content ?? '';
        const result = adaptiveSelectModel(lastUserMsg, historyText + system, false);
        actualModelId = result.modelId;
        model = AI_MODELS[actualModelId];
        chatStore.addMessage({
            id: Date.now().toString(36),
            role: 'assistant',
            content: `🔀 **Adaptive →** ${model.label} *(${AI_MODELS[actualModelId].provider})* — ${result.reason}`,
            timestamp: Date.now(),
            model: actualModelId
        });
    }
    if (!model) {
        chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: 'Error: modelo no encontrado.', timestamp: Date.now() });
        return;
    }
    const apiKeys = settingsStore.apiKeys;
    const provider = model.provider;
    const { path, headers } = getProviderConfig(provider, apiKeys);
    const authToken = (typeof window !== 'undefined' ? localStorage.getItem('codeai-auth') : '') || '';
    const authUser = (typeof window !== 'undefined' ? localStorage.getItem('codeai-user') : '') || '';
    const mergedHeaders = { ...headers, 'x-auth-token': authToken, 'x-auth-user': authUser };
    const session = sessions.find((s) => s.id === activeSessionId);
    const historyMessages = (session?.messages ?? [])
        .filter((m) => m.role !== 'system')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments, reasoning_content: m.reasoning_content }));
    let body = buildRequestBody(provider, actualModelId, historyMessages, system);
    if (path === '/api/ai-unified/chat') {
        if (provider === 'gemini') {
            const g = body;
            body = { provider, model: g.model, apiKey: g.apiKey, body: g.body };
        }
        else {
            body = { provider, ...body };
        }
    }
    chatStore.setStreaming(true);
    chatStore.setStreamContent('');
    try {
        const { response } = api.streamAI(path, body, mergedHeaders);
        const res = await response;
        if (!res.ok) {
            const errText = await res.text();
            chatStore.addMessage({
                id: Date.now().toString(36), role: 'assistant',
                content: `Error ${res.status}: ${errText.slice(0, 200)}`,
                timestamp: Date.now(), model: selectedModel,
            });
            chatStore.setStreaming(false);
            return;
        }
        const reader = res.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value, { stream: true });
            const text = parseChunk(chunk, provider);
            if (text) {
                fullContent += text;
                chatStore.setStreamContent(fullContent);
            }
        }
        chatStore.addMessage({
            id: Date.now().toString(36), role: 'assistant',
            content: fullContent || '(sin respuesta)',
            timestamp: Date.now(), model: actualModelId,
        });
        const promptTokens = Math.ceil((system.length + JSON.stringify(historyMessages).length) / 4);
        const completionTokens = Math.ceil(fullContent.length / 4);
        chatStore.incrementModelUsage(actualModelId, promptTokens + completionTokens);
        // Old-style agent processing (file blocks in markdown)
        if (chatStore.agentMode && fullContent) {
            await processAgentResponse(fullContent);
        }
    }
    catch (e) {
        if (e.name !== 'AbortError') {
            chatStore.addMessage({
                id: Date.now().toString(36), role: 'assistant',
                content: `Error: ${e.message}`,
                timestamp: Date.now(), model: selectedModel,
            });
        }
    }
    finally {
        chatStore.setStreaming(false);
        chatStore.setStreamContent('');
    }
}
// ═══════════════════════════════════════
// Main export: routes to agent or direct
// ═══════════════════════════════════════
/** Main entry point — delegates to agent loop or direct streaming */
export async function streamChat(_userMessage) {
    const { agentMode } = useChatStore.getState();
    const editorState = useEditorStore.getState();
    // Use agentic loop when agent mode is ON and we have a project root
    if (agentMode && editorState.rootPath) {
        return streamAgentChat();
    }
    // Otherwise use direct streaming (legacy)
    return streamDirectChat();
}
/** Parse an SSE chunk from different providers */
function parseChunk(chunk, provider) {
    let text = '';
    const lines = chunk.split('\n');
    for (const line of lines) {
        if (!line.startsWith('data: '))
            continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]')
            continue;
        try {
            const json = JSON.parse(data);
            switch (provider) {
                case 'claude':
                    if (json.type === 'content_block_delta' && json.delta?.text) {
                        text += json.delta.text;
                    }
                    break;
                case 'gemini':
                    if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
                        text += json.candidates[0].content.parts[0].text;
                    }
                    break;
                case 'openai':
                case 'deepseek':
                case 'openrouter':
                default:
                    if (json.choices?.[0]?.delta?.content) {
                        text += json.choices[0].delta.content;
                    }
                    break;
            }
        }
        catch {
            // skip malformed JSON
        }
    }
    return text;
}
