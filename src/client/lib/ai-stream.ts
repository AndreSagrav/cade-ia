import { api } from './api';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { processAgentResponse, executeAllChanges } from './agent';
import type { AIProvider } from '@shared/types';

/** Build the system prompt with project context */
function buildSystemPrompt(): string {
  const rootPath = useEditorStore.getState().rootPath;
  const contextFiles = useEditorStore.getState().contextFiles;
  const openFiles = useEditorStore.getState().openFiles;

  const agentMode = useChatStore.getState().agentMode;

  let system = `Eres CodeAI, un asistente de programación experto. Respondes en español.`;

  if (agentMode) {
    system += `\n\nMODO AGENTE ACTIVO. Puedes ejecutar acciones directamente:
- Para CREAR o EDITAR un archivo, usa: \`\`\`ts file:ruta/del/archivo.ts\\n...código completo...\\n\`\`\`
- Para EJECUTAR un comando, usa: \`\`\`run\\ncomando aquí\\n\`\`\`
- Puedes hacer múltiples acciones en una sola respuesta.
- Siempre explica brevemente qué vas a hacer antes de actuar.
- El contenido de file: REEMPLAZA todo el archivo (escribe el archivo completo).`;
  } else {
    system += `\nCuando generes código, usa bloques de código con el lenguaje indicado. Si necesitas modificar un archivo existente, indica el nombre del archivo.`;
  }

  if (rootPath) {
    system += `\n\nProyecto abierto: ${rootPath}`;
  }

  // Add context files content
  if (contextFiles.size > 0) {
    system += '\n\n--- ARCHIVOS EN CONTEXTO ---';
    for (const path of contextFiles) {
      const file = openFiles.get(path);
      if (file) {
        system += `\n\n### ${path}\n\`\`\`\n${file.content.slice(0, 8000)}\n\`\`\``;
      }
    }
  }

  return system;
}

/** Get route and headers for a given provider */
function getProviderConfig(provider: AIProvider, apiKeys: Record<string, string>) {
  switch (provider) {
    case 'claude':
      return { path: '/api/ai/claude', headers: { 'x-api-key': apiKeys.claude || '' } };
    case 'openai':
      return { path: '/api/ai/openai', headers: { 'Authorization': `Bearer ${apiKeys.openai || ''}` } };
    case 'gemini':
      return { path: '/api/ai/gemini', headers: {} };
    case 'deepseek':
      return { path: '/api/ai/deepseek', headers: { 'Authorization': `Bearer ${apiKeys.deepseek || ''}` } };
    case 'openrouter':
      return { path: '/api/ai/openrouter', headers: { 'Authorization': `Bearer ${apiKeys.openrouter || ''}` } };
    default:
      return { path: '/api/ai/openai', headers: {} };
  }
}

/** Build request body for each provider */
function buildRequestBody(
  provider: AIProvider,
  modelId: string,
  messages: { role: string; content: string }[],
  system: string,
) {
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

/** Parse SSE stream depending on provider */
export async function streamChat(_userMessage: string): Promise<void> {
  const chatStore = useChatStore.getState();
  const settingsStore = useSettingsStore.getState();
  const { selectedModel, sessions, activeSessionId } = chatStore;

  const model = AI_MODELS[selectedModel];
  if (!model) {
    chatStore.addMessage({
      id: Date.now().toString(36),
      role: 'assistant',
      content: 'Error: modelo no encontrado.',
      timestamp: Date.now(),
    });
    return;
  }

  const apiKeys = settingsStore.apiKeys as unknown as Record<string, string>;
  const provider = model.provider;
  const { path, headers } = getProviderConfig(provider, apiKeys);

  // Check if key exists
  const keyForProvider = apiKeys[provider] || '';
  if (!keyForProvider && provider !== 'nvidia') {
    chatStore.addMessage({
      id: Date.now().toString(36),
      role: 'assistant',
      content: `No tienes API key configurada para ${provider}. Ve a Configuración > API Keys.`,
      timestamp: Date.now(),
      model: selectedModel,
    });
    chatStore.setStreaming(false);
    return;
  }

  // Build messages history
  const session = sessions.find((s) => s.id === activeSessionId);
  const historyMessages = (session?.messages ?? [])
    .filter((m) => m.role !== 'system')
    .slice(-20) // limit context window
    .map((m) => ({ role: m.role, content: m.content }));

  const system = buildSystemPrompt();
  const body = buildRequestBody(provider, selectedModel, historyMessages, system);

  chatStore.setStreaming(true);
  chatStore.setStreamContent('');

  try {
    const { response } = api.streamAI(path, body, headers as Record<string, string>);
    const res = await response;

    if (!res.ok) {
      const errText = await res.text();
      chatStore.addMessage({
        id: Date.now().toString(36),
        role: 'assistant',
        content: `Error ${res.status}: ${errText.slice(0, 200)}`,
        timestamp: Date.now(),
        model: selectedModel,
      });
      chatStore.setStreaming(false);
      return;
    }

    // Parse streaming response
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const text = parseChunk(chunk, provider);
      if (text) {
        fullContent += text;
        chatStore.setStreamContent(fullContent);
      }
    }

    chatStore.addMessage({
      id: Date.now().toString(36),
      role: 'assistant',
      content: fullContent || '(sin respuesta)',
      timestamp: Date.now(),
      model: selectedModel,
    });

    // Agent mode: parse response and auto-execute changes
    if (chatStore.agentMode && fullContent) {
      processAgentResponse(fullContent);
      await executeAllChanges();
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      chatStore.addMessage({
        id: Date.now().toString(36),
        role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: Date.now(),
        model: selectedModel,
      });
    }
  } finally {
    chatStore.setStreaming(false);
    chatStore.setStreamContent('');
  }
}

/** Parse an SSE chunk from different providers */
function parseChunk(chunk: string, provider: AIProvider): string {
  let text = '';
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') continue;

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
    } catch {
      // skip malformed JSON
    }
  }

  return text;
}
