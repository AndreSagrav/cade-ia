import { describe, it, expect } from 'vitest';
import { StreamReconstructor, dialectForProvider } from '../src/server/lib/stream-parser';

/** Feed an SSE string in arbitrary chunk sizes to exercise buffering. */
function feed(dialect: 'openai' | 'claude' | 'gemini', sse: string, chunkSize = 7) {
  const r = new StreamReconstructor(dialect);
  let text = '';
  for (let i = 0; i < sse.length; i += chunkSize) {
    text += r.push(sse.slice(i, i + chunkSize));
  }
  const json = r.finish();
  return { text, json };
}

describe('dialectForProvider', () => {
  it('maps providers to dialects', () => {
    expect(dialectForProvider('claude')).toBe('claude');
    expect(dialectForProvider('gemini')).toBe('gemini');
    for (const p of ['openai', 'deepseek', 'nvidia', 'openrouter', 'whatever']) {
      expect(dialectForProvider(p)).toBe('openai');
    }
  });
});

describe('OpenAI-compatible streaming', () => {
  it('reconstructs streamed text and emits deltas', () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant","content":"Hola"}}]}',
      'data: {"choices":[{"delta":{"content":" mundo"}}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
    ].join('\n\n') + '\n\n';
    const { text, json } = feed('openai', sse);
    expect(text).toBe('Hola mundo');
    expect(json.choices[0].message.content).toBe('Hola mundo');
    expect(json.choices[0].finish_reason).toBe('stop');
    expect(json.choices[0].message.tool_calls).toBeUndefined();
  });

  it('reconstructs streamed tool calls split across chunks', () => {
    const sse = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"write_file","arguments":"{\\"path\\":\\"a"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":".txt\\",\\"content\\":\\"hi\\"}"}}]}}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
      'data: [DONE]',
    ].join('\n\n') + '\n\n';
    const { text, json } = feed('openai', sse);
    expect(text).toBe('');
    const tc = json.choices[0].message.tool_calls[0];
    expect(tc.id).toBe('call_1');
    expect(tc.function.name).toBe('write_file');
    expect(JSON.parse(tc.function.arguments)).toEqual({ path: 'a.txt', content: 'hi' });
    expect(json.choices[0].finish_reason).toBe('tool_calls');
  });

  it('reports length finish_reason for truncation detection', () => {
    const sse = 'data: {"choices":[{"delta":{"content":"x"},"finish_reason":"length"}]}\n\n';
    const { json } = feed('openai', sse);
    expect(json.choices[0].finish_reason).toBe('length');
  });
});

describe('Claude streaming', () => {
  it('reconstructs text blocks and stop_reason', () => {
    const sse = [
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hola"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" mundo"}}',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
    ].join('\n\n') + '\n\n';
    const { text, json } = feed('claude', sse);
    expect(text).toBe('Hola mundo');
    expect(json.content[0]).toEqual({ type: 'text', text: 'Hola mundo' });
    expect(json.stop_reason).toBe('end_turn');
  });

  it('reconstructs tool_use blocks with streamed partial json', () => {
    const sse = [
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"read_file"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\":"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"x.ts\\"}"}}',
      'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
    ].join('\n\n') + '\n\n';
    const { json } = feed('claude', sse);
    const block = json.content[0];
    expect(block.type).toBe('tool_use');
    expect(block.name).toBe('read_file');
    expect(block.input).toEqual({ path: 'x.ts' });
    expect(json.stop_reason).toBe('tool_use');
  });
});

describe('Gemini streaming', () => {
  it('reconstructs streamed text parts', () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hola"}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":" mundo"}]},"finishReason":"STOP"}]}',
    ].join('\n\n') + '\n\n';
    const { text, json } = feed('gemini', sse);
    expect(text).toBe('Hola mundo');
    expect(json.candidates[0].content.parts[0].text).toBe('Hola mundo');
    expect(json.candidates[0].finishReason).toBe('STOP');
  });

  it('reconstructs functionCall parts', () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"list_files","args":{"path":"."}}}]},"finishReason":"STOP"}]}',
    ].join('\n\n') + '\n\n';
    const { json } = feed('gemini', sse);
    const fc = json.candidates[0].content.parts.find((p: any) => p.functionCall);
    expect(fc.functionCall.name).toBe('list_files');
    expect(fc.functionCall.args).toEqual({ path: '.' });
  });
});

describe('robustness', () => {
  it('ignores keepalive / non-JSON lines and works across tiny chunks', () => {
    const sse = ': ping\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
    const { text, json } = feed('openai', sse, 1);
    expect(text).toBe('ok');
    expect(json.choices[0].message.content).toBe('ok');
  });
});
