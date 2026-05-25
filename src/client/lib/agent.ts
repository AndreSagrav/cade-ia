import { api } from './api';
import { useEditorStore } from '@/store/editor-store';
import type { PendingChange } from '@shared/types';

/**
 * Parse AI response to detect actionable blocks:
 * - ```file:path/to/file.ts  → write file
 * - ```run: command           → execute command
 */
export function parseAgentActions(content: string): PendingChange[] {
  const changes: PendingChange[] = [];
  
  // Match file blocks: ```language file:path\n...code...\n```
  const fileRegex = /```(?:\w+)?\s*file:([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    changes.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'replace',
      file: match[1].trim(),
      content: match[2].trimEnd(),
      status: 'pending',
    });
  }

  // Match run blocks: ```run\n...command...\n```
  const runRegex = /```run\n([\s\S]*?)```/g;
  while ((match = runRegex.exec(content)) !== null) {
    const cmds = match[1].trim().split('\n').filter(Boolean);
    for (const cmd of cmds) {
      changes.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'run',
        content: cmd.trim(),
        status: 'pending',
      });
    }
  }

  return changes;
}

/**
 * Execute a single pending change
 */
export async function executeChange(change: PendingChange): Promise<{ ok: boolean; error?: string }> {
  const rootPath = useEditorStore.getState().rootPath;
  if (!rootPath) return { ok: false, error: 'No project open' };

  try {
    if (change.type === 'replace' && change.file) {
      // Write file
      await api.writeFile({
        path: change.file,
        content: change.content,
        root: rootPath,
      });
      return { ok: true };
    }

    if (change.type === 'run') {
      // Execute command
      const result = await api.runCommand({ cmd: change.content, cwd: rootPath });
      if (result.code !== 0 && result.stderr) {
        return { ok: false, error: result.stderr.slice(0, 200) };
      }
      return { ok: true };
    }

    return { ok: false, error: 'Unknown change type' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Execute all pending changes sequentially
 */
export async function executeAllChanges(): Promise<void> {
  const store = useEditorStore.getState();
  const changes = store.pendingChanges.filter((c) => c.status === 'pending');

  for (const change of changes) {
    const result = await executeChange(change);
    store.updateChangeStatus(change.id, result.ok ? 'accepted' : 'rejected');
  }

  // Refresh file tree after changes
  if (store.rootPath) {
    const treeResult = await api.getTree({ root: store.rootPath });
    store.setFileTree(treeResult.items as any);
  }
}

/**
 * Process AI response in agent mode: parse and queue changes
 */
export function processAgentResponse(content: string): void {
  const changes = parseAgentActions(content);
  if (changes.length === 0) return;

  const store = useEditorStore.getState();
  for (const change of changes) {
    store.addPendingChange(change);
  }
}
