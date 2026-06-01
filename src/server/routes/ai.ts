import { Router, Request, Response } from 'express';
import { config } from '../config';

function maskKey(key: string | undefined | null): string {
  if (!key) return 'none';
  const tail = key.slice(-4);
  return `***${tail}`;
}

export const aiRouter = Router();

/** Extract a usable Bearer key from header, or fall back to config */
function resolveBearer(header: string | undefined, fallback: string): string {
  const h = (header || '').trim();
  // "Bearer " alone or empty → use fallback
  if (!h || h === 'Bearer' || h === 'Bearer ') return `Bearer ${fallback}`;
  return h;
}

function resolveRaw(header: string | undefined, fallback: string): string {
  const h = (header || '').trim();
  return h || fallback;
}

/** Fetch with timeout wrapper to prevent hanging proxy requests */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 90000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Expiró el tiempo de espera (${timeoutMs}ms) al conectar con el proveedor de IA. Por favor intenta de nuevo.`);
    }
    throw err;
  }
}

// Claude (Anthropic) proxy
aiRouter.post('/claude', async (req: Request, res: Response) => {
  const apiKey = resolveRaw(req.headers['x-api-key'] as string, config.anthropicApiKey);
  if (!apiKey) return res.status(401).json({ error: 'No Anthropic API key configured' });

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    // Stream the response back
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      pump().catch(() => res.end());
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});

// OpenAI proxy
aiRouter.post('/openai', async (req: Request, res: Response) => {
  const apiKey = resolveBearer(req.headers['authorization'] as string, config.openaiApiKey);
  if (apiKey === 'Bearer ') return res.status(401).json({ error: 'No OpenAI API key' });

  try {
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const txt = await response.text();
      console.log(`[CodeAI][GeminiProxy] non-stream status=${response.status} model=${req.body.model || 'unknown'} key=${maskKey(apiKey)} body=${txt.slice(0,200)}`);
      res.send(txt);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});

// Gemini proxy
aiRouter.post('/gemini', async (req: Request, res: Response) => {
  const { apiKey: clientKey, model, body: geminiBody } = req.body;
  const apiKey = clientKey || config.geminiApiKey;
  if (!apiKey) return res.status(401).json({ error: 'No Gemini API key' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    // Detect quota exhaustion early — don't stream error SSE back to client
    if (response.status === 429) {
      const errBody = await response.text();
      const isQuota = errBody.toLowerCase().includes('quota') || errBody.toLowerCase().includes('exhausted') || errBody.toLowerCase().includes('resource');
      if (isQuota) {
        return res.status(429).json({ error: 'QUOTA_EXHAUSTED', message: 'Se agotó la cuota gratuita diaria de Gemini. Espera a que se renueve (24h) o usa otro modelo como OpenRouter o NVIDIA.', detail: errBody.slice(0, 300) });
      }
    }

    if (!response.ok && response.status !== 429) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `Gemini API error ${response.status}`, detail: errBody.slice(0, 300) });
    }

    res.status(response.status);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.send(await response.text());
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});

// DeepSeek proxy
aiRouter.post('/deepseek', async (req: Request, res: Response) => {
  const apiKey = resolveBearer(req.headers['authorization'] as string, config.deepseekApiKey);
  if (apiKey === 'Bearer ') return res.status(401).json({ error: 'No DeepSeek API key' });

  try {
    const response = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.send(await response.text());
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});

// NVIDIA NIM proxy (OpenAI-compatible API)
aiRouter.post('/nvidia', async (req: Request, res: Response) => {
  const apiKey = resolveBearer(req.headers['authorization'] as string, config.nvidiaApiKey);
  if (apiKey === 'Bearer ') return res.status(401).json({ error: 'No NVIDIA API key' });

  try {
    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.send(await response.text());
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});

// OpenRouter proxy
aiRouter.post('/openrouter', async (req: Request, res: Response) => {
  const apiKey = resolveBearer(req.headers['authorization'] as string, config.openrouterApiKey);
  if (apiKey === 'Bearer ') return res.status(401).json({ error: 'No OpenRouter API key' });

  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'HTTP-Referer': 'https://codeai.studio',
        'X-Title': 'CodeAI Studio',
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.send(await response.text());
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    res.status(500).json({ error: message });
  }
});
