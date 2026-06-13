import { api } from './api';
import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { getLanguageFromPath } from './utils';
import type { PendingChange } from '@shared/types';

/**
 * Reverts all agent file changes that occurred after the given messageId,
 * then truncates the chat history.
 */
export async function rewindToMessage(messageId: string): Promise<void> {
  const chatStore = useChatStore.getState();
  const editorStore = useEditorStore.getState();
  const rootPath = editorStore.rootPath;
  if (!rootPath) return;

  const session = chatStore.sessions.find(s => s.id === chatStore.activeSessionId);
  if (!session) return;

  const messages = session.messages;
  const targetIndex = messages.findIndex(m => m.id === messageId);
  if (targetIndex === -1) return;

  // Revert changes in reverse chronological order
  for (let i = messages.length - 1; i > targetIndex; i--) {
    const msg = messages[i];
    if (msg.agentChanges && msg.agentChanges.length > 0) {
      for (let j = msg.agentChanges.length - 1; j >= 0; j--) {
        const change = msg.agentChanges[j];
        try {
          await api.writeFile({
            path: change.path,
            content: change.oldContent,
            root: rootPath,
          });
          
          // Revert preview if active, or update open file content
          editorStore.revertPreview(change.path);
          editorStore.updateFileContent(change.path, change.oldContent);
          editorStore.markFileSaved(change.path);
        } catch (e) {
          console.error('Failed to rewind file:', change.path, e);
        }
      }
    }
  }

  // Truncate messages after targetIndex
  chatStore.truncateMessagesFrom(messageId);
}

/** Generate a stable-ish unique id */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Parse AI response to detect actionable blocks:
 * - ```ts file:path/to/file.ts  → write/replace file
 * - ```run                        → execute command
 */
export function parseAgentActions(content: string): PendingChange[] {
  const changes: PendingChange[] = [];

  // Match file blocks: ```language file:path\n...code...\n```
  const fileRegex = /```(?:\w+)?\s*file:([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    changes.push({
      id: uid(),
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
        id: uid(),
        type: 'run',
        content: cmd.trim(),
        status: 'pending',
      });
    }
  }

  return changes;
}

/**
 * Strip agent action blocks (file:, run) from a message so only prose remains.
 * Used so the chat doesn't show the raw code – the code lives in the editor.
 */
export function stripAgentBlocks(content: string): string {
  return content
    .replace(/```(?:\w+)?\s*file:[^\n]+\n[\s\S]*?```/g, '')
    .replace(/```run\n[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * For each file change: load the current file content and open it in the editor
 * as a preview (yellow-highlighted). The change stays pending until the user
 * clicks Accept or Reject from the floating bar.
 */
export async function processAgentResponse(content: string): Promise<void> {
  const changes = parseAgentActions(content);
  if (changes.length === 0) return;

  const store = useEditorStore.getState();
  const chat = useChatStore.getState();
  const rootPath = store.rootPath;

  for (const change of changes) {
    if (change.type === 'replace' && change.file) {
      // Fetch current content (or empty if new file)
      let original = '';
      if (rootPath) {
        try {
          const res = await api.readFile({ path: change.file, root: rootPath });
          if (res.ok) original = res.content;
        } catch {
          // file doesn't exist yet → empty original (new file)
        }
      }

      // Ensure the file is open in the editor
      const openFiles = useEditorStore.getState().openFiles;
      if (!openFiles.has(change.file)) {
        useEditorStore.getState().openFile(change.file, {
          path: change.file,
          content: original,
          language: getLanguageFromPath(change.file),
          modified: false,
        });
      }

      const id = change.id;
      if (chat.autoApply && rootPath) {
        try {
          await api.writeFile({ path: change.file, content: change.content, root: rootPath });
          // Update editor state to reflect saved changes
          useEditorStore.getState().updateFileContent(change.file, change.content);
          useEditorStore.getState().markFileSaved(change.file);
          useEditorStore.getState().addPendingChange({
            id,
            type: 'replace',
            file: change.file,
            content: change.content,
            original,
            status: 'accepted',
          });
          continue; // done for this change
        } catch {
          // fall through to preview path if write fails
        }
      }

      // Preview path (no auto-apply or write failed)
      useEditorStore.getState().addPendingChange({
        id,
        type: 'replace',
        file: change.file,
        content: change.content,
        original,
        status: 'pending',
      });
      useEditorStore.getState().applyPreview(change.file, original, change.content, id);
    } else if (change.type === 'run') {
      if (chat.autoRun && rootPath) {
        // Execute immediately via IPC if available, else HTTP fallback
        const wapi: any = (typeof window !== 'undefined' ? (window as any).api : null);
        const useIpc = !!(wapi && wapi.shell && wapi.shell.run);
        (async () => {
          try {
            if (useIpc) {
              // Parse simple shell commands for IPC (single command + args)
              const cmd = change.content;
              const isWin = navigator.platform.startsWith('Win');
              const shell = isWin ? 'powershell.exe' : (process.env?.SHELL || 'bash');
              const args = isWin ? ['-NoProfile','-NonInteractive','-Command', cmd] : ['-c', cmd];
              await wapi.shell.run(shell, args, rootPath, undefined, 120000);
            } else {
              await api.runCommand({ cmd: change.content, cwd: rootPath });
            }
            store.addPendingChange({ ...change, status: 'accepted' });
            store.updateChangeStatus(change.id, 'accepted');
          } catch (e: any) {
            store.addPendingChange({ ...change, status: 'rejected' });
            store.updateChangeStatus(change.id, 'rejected');
          }
        })();
      } else {
        // Keep pending for manual confirmation
        store.addPendingChange(change);
      }
    }
  }

  // Auto-sync to GitHub if enabled and there were file changes
  const hadFileChanges = changes.some((c) => c.type === 'replace');
  if (hadFileChanges && chat.autoSync && rootPath) {
    (async () => {
      const res = await gitSync(rootPath);
      if (!res.ok) {
        chat.addMessage({
          id: Date.now().toString(36), role: 'assistant',
          content: `⚠️ Sync falló: ${res.message}`,
          timestamp: Date.now(),
        });
      }
    })();
  }
}

/**
 * Accept a single pending change: persist preview to disk, mark accepted.
 */
export async function acceptChange(change: PendingChange): Promise<{ ok: boolean; error?: string }> {
  const store = useEditorStore.getState();
  const rootPath = store.rootPath;
  if (!rootPath) return { ok: false, error: 'No project open' };

  try {
    if (change.type === 'replace' && change.file) {
      await api.writeFile({
        path: change.file,
        content: change.content,
        root: rootPath,
      });
      store.commitPreview(change.file);
      store.updateChangeStatus(change.id, 'accepted');
      return { ok: true };
    }

    if (change.type === 'run') {
      const result = await api.runCommand({ cmd: change.content, cwd: rootPath });
      store.updateChangeStatus(change.id, 'accepted');
      if (result.code !== 0 && result.stderr) {
        return { ok: false, error: result.stderr.slice(0, 200) };
      }
      return { ok: true };
    }

    return { ok: false, error: 'Unknown change type' };
  } catch (e: any) {
    store.updateChangeStatus(change.id, 'rejected');
    return { ok: false, error: e.message };
  }
}

/**
 * Reject a single pending change: revert preview, mark rejected.
 */
export async function rejectChange(change: PendingChange): Promise<void> {
  const store = useEditorStore.getState();
  const rootPath = store.rootPath;
  if (change.type === 'replace' && change.file) {
    // If the agent wrote changes to disk, we must restore the old content
    if (rootPath && change.original !== undefined) {
      try {
        await api.writeFile({
          path: change.file,
          content: change.original,
          root: rootPath,
        });
      } catch (e) {
        console.error('Failed to revert file on disk:', e);
      }
    }
    store.revertPreview(change.file);
  }
  store.updateChangeStatus(change.id, 'rejected');
}

/**
 * Auto-sync file changes to GitHub via git add/commit/push.
 * Uses IPC shell.run when available, falls back to HTTP api.runCommand.
 */
export async function gitSync(rootPath: string): Promise<{ ok: boolean; message: string }> {
  const wapi: any = (typeof window !== 'undefined' ? (window as any).api : null);
  const useIpc = !!(wapi && wapi.shell && wapi.shell.run);
  const isWin = navigator.platform.startsWith('Win');
  const shell = isWin ? 'powershell.exe' : 'bash';
  const gitAddArgs = isWin
    ? ['-NoProfile', '-NonInteractive', '-Command', 'cd "' + rootPath + '"; git add -A']
    : ['-c', 'cd "' + rootPath + '" && git add -A'];
  const gitCommitArgs = isWin
    ? ['-NoProfile', '-NonInteractive', '-Command', 'cd "' + rootPath + '"; git commit -m "CodeAI auto-sync ' + new Date().toISOString() + '"']
    : ['-c', 'cd "' + rootPath + '" && git commit -m "CodeAI auto-sync ' + new Date().toISOString() + '"'];
  const gitPushArgs = isWin
    ? ['-NoProfile', '-NonInteractive', '-Command', 'cd "' + rootPath + '"; git push']
    : ['-c', 'cd "' + rootPath + '" && git push'];

  try {
    if (useIpc) {
      await wapi.shell.run(shell, gitAddArgs, rootPath, undefined, 15000);
      await wapi.shell.run(shell, gitCommitArgs, rootPath, undefined, 15000);
      await wapi.shell.run(shell, gitPushArgs, rootPath, undefined, 30000);
    } else {
      await api.runCommand({ cmd: 'git add -A', cwd: rootPath });
      await api.runCommand({ cmd: `git commit -m "CodeAI auto-sync ${new Date().toISOString()}"`, cwd: rootPath });
      await api.runCommand({ cmd: 'git push', cwd: rootPath });
    }
    return { ok: true, message: 'Sync OK' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Sync failed' };
  }
}
