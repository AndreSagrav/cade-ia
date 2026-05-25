import { Router, Request, Response } from 'express';
import { config } from '../config';

export const aiRouter = Router();

// Claude (Anthropic) proxy
aiRouter.post('/claude', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string || config.anthropicApiKey;
  if (!apiKey) return res.status(401).json({ error: 'No Anthropic API key configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  const apiKey = req.headers['authorization'] as string || `Bearer ${config.openaiApiKey}`;
  if (!apiKey || apiKey === 'Bearer ') return res.status(401).json({ error: 'No OpenAI API key' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
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

// Gemini proxy
aiRouter.post('/gemini', async (req: Request, res: Response) => {
  const { apiKey: clientKey, model, body: geminiBody } = req.body;
  const apiKey = clientKey || config.geminiApiKey;
  if (!apiKey) return res.status(401).json({ error: 'No Gemini API key' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    res.status(response.status);
    res.setHeader('Content-Type', 'text/event-stream');
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
  const apiKey = req.headers['authorization'] as string || `Bearer ${config.deepseekApiKey}`;
  if (!apiKey || apiKey === 'Bearer ') return res.status(401).json({ error: 'No DeepSeek API key' });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
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
  const apiKey = req.headers['authorization'] as string || `Bearer ${config.nvidiaApiKey}`;
  if (!apiKey || apiKey === 'Bearer ') return res.status(401).json({ error: 'No NVIDIA API key' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
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
  const apiKey = req.headers['authorization'] as string || `Bearer ${config.openrouterApiKey}`;
  if (!apiKey || apiKey === 'Bearer ') return res.status(401).json({ error: 'No OpenRouter API key' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
