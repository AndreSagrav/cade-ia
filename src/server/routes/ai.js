import { Router } from 'express';
import { config } from '../config';
import { z } from 'zod';
export const aiRouter = Router();
/** Extract a usable Bearer key from header, or fall back to config */
function resolveBearer(header, fallback) {
    const h = (header || '').trim();
    // "Bearer " alone or empty → use fallback
    if (!h || h === 'Bearer' || h === 'Bearer ')
        return `Bearer ${fallback}`;
    return h;
}
function resolveRaw(header, fallback) {
    const h = (header || '').trim();
    return h || fallback;
}
// Claude (Anthropic) proxy
aiRouter.post('/claude', async (req, res) => {
    const apiKey = resolveRaw(req.headers['x-api-key'], config.anthropicApiKey);
    if (!apiKey)
        return res.status(401).json({ error: 'No Anthropic API key configured' });
    try {
        const bodySchema = z.object({}).passthrough();
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid body' });
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(parsed.data),
        });
        // Stream the response back
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
        if (response.body) {
            const reader = response.body.getReader();
            const pump = async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    res.write(value);
                }
                res.end();
            };
            pump().catch(() => res.end());
        }
        else {
            const text = await response.text();
            res.send(text);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
// OpenAI proxy
aiRouter.post('/openai', async (req, res) => {
    const apiKey = resolveBearer(req.headers['authorization'], config.openaiApiKey);
    if (apiKey === 'Bearer ')
        return res.status(401).json({ error: 'No OpenAI API key' });
    try {
        const bodySchema = z.object({}).passthrough();
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid body' });
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
            },
            body: JSON.stringify(parsed.data),
        });
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
        if (response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                res.write(value);
            }
            res.end();
        }
        else {
            res.send(await response.text());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
// Gemini proxy
aiRouter.post('/gemini', async (req, res) => {
    const schema = z.object({
        apiKey: z.string().optional(),
        model: z.string().min(1),
        body: z.object({}).passthrough(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { apiKey: clientKey, model, body: geminiBody } = parsed.data;
    const apiKey = clientKey || config.geminiApiKey;
    if (!apiKey)
        return res.status(401).json({ error: 'No Gemini API key' });
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
                if (done)
                    break;
                res.write(value);
            }
            res.end();
        }
        else {
            res.send(await response.text());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
// DeepSeek proxy
aiRouter.post('/deepseek', async (req, res) => {
    const apiKey = resolveBearer(req.headers['authorization'], config.deepseekApiKey);
    if (apiKey === 'Bearer ')
        return res.status(401).json({ error: 'No DeepSeek API key' });
    try {
        const bodySchema = z.object({}).passthrough();
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid body' });
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
            },
            body: JSON.stringify(parsed.data),
        });
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
        if (response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                res.write(value);
            }
            res.end();
        }
        else {
            res.send(await response.text());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
// NVIDIA NIM proxy (OpenAI-compatible API)
aiRouter.post('/nvidia', async (req, res) => {
    const apiKey = resolveBearer(req.headers['authorization'], config.nvidiaApiKey);
    if (apiKey === 'Bearer ')
        return res.status(401).json({ error: 'No NVIDIA API key' });
    try {
        const bodySchema = z.object({}).passthrough();
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid body' });
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
            },
            body: JSON.stringify(parsed.data),
        });
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
        if (response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                res.write(value);
            }
            res.end();
        }
        else {
            res.send(await response.text());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
// OpenRouter proxy
aiRouter.post('/openrouter', async (req, res) => {
    const apiKey = resolveBearer(req.headers['authorization'], config.openrouterApiKey);
    if (apiKey === 'Bearer ')
        return res.status(401).json({ error: 'No OpenRouter API key' });
    try {
        const bodySchema = z.object({}).passthrough();
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid body' });
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
                'HTTP-Referer': 'https://codeai.studio',
                'X-Title': 'CodeAI Studio',
            },
            body: JSON.stringify(parsed.data),
        });
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/event-stream');
        if (response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                res.write(value);
            }
            res.end();
        }
        else {
            res.send(await response.text());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Proxy error';
        res.status(500).json({ error: message });
    }
});
