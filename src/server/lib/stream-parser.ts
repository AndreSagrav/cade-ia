/**
 * Universal SSE stream reconstruction for the agent loop (FASE 2.1).
 *
 * Each provider streams in its own Server-Sent-Events dialect. This module
 * consumes the raw byte/text chunks as they arrive, emits incremental text
 * deltas (so the UI feels fluid), and at the end reconstructs the SAME JSON
 * shape the non-streaming endpoint would have returned. That lets the existing
 * `adapter.parseResponse(json)` + universal tool parser keep working unchanged,
 * so streaming never weakens FASE 1 robustness.
 *
 * Supported dialects:
 *  - 'openai'  → OpenAI-compatible (OpenAI, DeepSeek, NVIDIA, OpenRouter)
 *  - 'claude'  → Anthropic Messages streaming
 *  - 'gemini'  → Google streamGenerateContent (alt=sse)
 */

export type StreamDialect = 'openai' | 'claude' | 'gemini';

export function dialectForProvider(provider: string): StreamDialect {
  if (provider === 'claude') return 'claude';
  if (provider === 'gemini') return 'gemini';
  return 'openai';
}

/** Extract the `data:` payloads from one SSE event block (handles multi-line). */
function dataPayload(eventBlock: string): string | null {
  const lines = eventBlock.split(/\r?\n/);
  const data: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length === 0) return null;
  return data.join('\n');
}

export class StreamReconstructor {
  private dialect: StreamDialect;
  private buffer = '';

  // openai state
  private oaContent = '';
  private oaToolCalls: Array<{ id?: string; name?: string; args: string }> = [];
  private oaFinish: string | undefined;

  // claude state
  private clBlocks: any[] = [];
  private clPartialJson: Record<number, string> = {};
  private clStop: string | undefined;

  // gemini state
  private gmText = '';
  private gmFunctionCalls: any[] = [];
  private gmFinish: string | undefined;

  constructor(dialect: StreamDialect) {
    this.dialect = dialect;
  }

  /** Feed a raw text chunk; returns any newly-decoded assistant text to emit. */
  push(chunk: string): string {
    this.buffer += chunk;
    let delta = '';
    let sepIndex: number;
    // Events are separated by a blank line.
    while ((sepIndex = this.indexOfSeparator(this.buffer)) !== -1) {
      const sepLen = this.buffer.startsWith('\r\n\r\n', sepIndex) ? 4 : 2;
      const block = this.buffer.slice(0, sepIndex);
      this.buffer = this.buffer.slice(sepIndex + sepLen);
      delta += this.processEvent(block);
    }
    return delta;
  }

  /** Flush any trailing event left in the buffer (no terminating blank line). */
  finish(): any {
    if (this.buffer.trim().length > 0) {
      const tail = this.buffer;
      this.buffer = '';
      this.processEvent(tail);
    }
    return this.reconstruct();
  }

  private indexOfSeparator(s: string): number {
    const a = s.indexOf('\n\n');
    const b = s.indexOf('\r\n\r\n');
    if (a === -1) return b;
    if (b === -1) return a;
    return Math.min(a, b);
  }

  private processEvent(block: string): string {
    const payload = dataPayload(block);
    if (payload === null) return '';
    const trimmed = payload.trim();
    if (trimmed === '' || trimmed === '[DONE]') return '';
    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return ''; // partial/non-JSON keepalive — ignore
    }
    switch (this.dialect) {
      case 'openai': return this.onOpenAI(obj);
      case 'claude': return this.onClaude(obj);
      case 'gemini': return this.onGemini(obj);
      default: return '';
    }
  }

  // ── OpenAI-compatible ────────────────────────────────────────────────────
  private onOpenAI(obj: any): string {
    const choice = obj?.choices?.[0];
    if (!choice) return '';
    let delta = '';
    const d = choice.delta;
    if (d) {
      if (typeof d.content === 'string' && d.content.length > 0) {
        this.oaContent += d.content;
        delta += d.content;
      }
      if (Array.isArray(d.tool_calls)) {
        for (const tc of d.tool_calls) {
          const idx = typeof tc.index === 'number' ? tc.index : this.oaToolCalls.length;
          if (!this.oaToolCalls[idx]) this.oaToolCalls[idx] = { args: '' };
          if (tc.id) this.oaToolCalls[idx].id = tc.id;
          if (tc.function?.name) this.oaToolCalls[idx].name = tc.function.name;
          if (typeof tc.function?.arguments === 'string') this.oaToolCalls[idx].args += tc.function.arguments;
        }
      }
    }
    if (choice.finish_reason) this.oaFinish = choice.finish_reason;
    return delta;
  }

  // ── Anthropic Claude ─────────────────────────────────────────────────────
  private onClaude(obj: any): string {
    switch (obj?.type) {
      case 'content_block_start': {
        const cb = obj.content_block || {};
        this.clBlocks[obj.index] = cb.type === 'text'
          ? { type: 'text', text: cb.text || '' }
          : { type: cb.type, id: cb.id, name: cb.name, input: {} };
        if (cb.type === 'tool_use') this.clPartialJson[obj.index] = '';
        return '';
      }
      case 'content_block_delta': {
        const d = obj.delta || {};
        if (d.type === 'text_delta' && typeof d.text === 'string') {
          if (!this.clBlocks[obj.index]) this.clBlocks[obj.index] = { type: 'text', text: '' };
          this.clBlocks[obj.index].text += d.text;
          return d.text;
        }
        if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
          this.clPartialJson[obj.index] = (this.clPartialJson[obj.index] || '') + d.partial_json;
        }
        return '';
      }
      case 'message_delta': {
        if (obj.delta?.stop_reason) this.clStop = obj.delta.stop_reason;
        return '';
      }
      default:
        return '';
    }
  }

  // ── Google Gemini ────────────────────────────────────────────────────────
  private onGemini(obj: any): string {
    const cand = obj?.candidates?.[0];
    if (!cand) return '';
    let delta = '';
    const parts = cand.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p.text === 'string' && p.text.length > 0) {
          this.gmText += p.text;
          delta += p.text;
        } else if (p.functionCall) {
          this.gmFunctionCalls.push(p);
        }
      }
    }
    if (cand.finishReason) this.gmFinish = cand.finishReason;
    return delta;
  }

  // ── Reconstruct the non-streaming JSON shape ──────────────────────────────
  private reconstruct(): any {
    if (this.dialect === 'openai') {
      const message: any = { role: 'assistant', content: this.oaContent || null };
      const tcs = this.oaToolCalls.filter(Boolean).filter((t) => t.name);
      if (tcs.length > 0) {
        message.tool_calls = tcs.map((t, i) => ({
          id: t.id || `stream-${i}`,
          type: 'function',
          function: { name: t.name, arguments: t.args || '{}' },
        }));
      }
      return { choices: [{ message, finish_reason: this.oaFinish }] };
    }
    if (this.dialect === 'claude') {
      const blocks = this.clBlocks.filter(Boolean).map((b, i) => {
        if (b.type === 'tool_use') {
          let input = {};
          const raw = this.clPartialJson[i];
          if (raw && raw.trim()) { try { input = JSON.parse(raw); } catch { input = {}; } }
          return { ...b, input };
        }
        return b;
      });
      return { content: blocks, stop_reason: this.clStop };
    }
    // gemini
    const parts: any[] = [];
    if (this.gmText) parts.push({ text: this.gmText });
    for (const fc of this.gmFunctionCalls) parts.push(fc);
    return { candidates: [{ content: { parts }, finishReason: this.gmFinish }] };
  }
}
