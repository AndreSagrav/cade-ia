import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
export const aiUnifiedRouter = Router();
function resolveBearer(header, fallback) {
    const h = (header || '').trim();
    if (!h || h === 'Bearer' || h === 'Bearer ')
        return fallback ? `Bearer ${fallback}` : '';
    return h;
}
aiUnifiedRouter.post('/chat', async (req, res) => {
    const schema = z.object({
        provider: z.enum(['openai', 'claude', 'gemini', 'deepseek', 'nvidia', 'openrouter']),
        model: z.string().min(1),
    }).passthrough();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid body' });
    }
    const body = parsed.data;
    const provider = body.provider;
    const start = Date.now();
    try {
        let upstreamUrl = '';
        let headers = { 'Content-Type': 'application/json' };
        let upstreamBody = body;
        switch (provider) {
            case 'claude': {
                const apiKey = req.headers['x-api-key']?.trim() || config.anthropicApiKey;
                if (!apiKey)
                    return res.status(401).json({ error: 'No Anthropic API key' });
                upstreamUrl = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
                upstreamBody = { ...body };
                delete upstreamBody.provider;
                break;
            }
            case 'openai': {
                const bearer = resolveBearer(req.headers['authorization'], config.openaiApiKey);
                if (!bearer || bearer === 'Bearer ')
                    return res.status(401).json({ error: 'No OpenAI API key' });
                upstreamUrl = 'https://api.openai.com/v1/chat/completions';
                headers['Authorization'] = bearer;
                upstreamBody = { ...body };
                delete upstreamBody.provider;
                break;
            }
            case 'deepseek': {
                const bearer = resolveBearer(req.headers['authorization'], config.deepseekApiKey);
                if (!bearer || bearer === 'Bearer ')
                    return res.status(401).json({ error: 'No DeepSeek API key' });
                upstreamUrl = 'https://api.deepseek.com/chat/completions';
                headers['Authorization'] = bearer;
                upstreamBody = { ...body };
                delete upstreamBody.provider;
                break;
            }
            case 'nvidia': {
                const bearer = resolveBearer(req.headers['authorization'], config.nvidiaApiKey);
                if (!bearer || bearer === 'Bearer ')
                    return res.status(401).json({ error: 'No NVIDIA API key' });
                upstreamUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
                headers['Authorization'] = bearer;
                upstreamBody = { ...body };
                delete upstreamBody.provider;
                break;
            }
            case 'openrouter': {
                const bearer = resolveBearer(req.headers['authorization'], config.openrouterApiKey);
                if (!bearer || bearer === 'Bearer ')
                    return res.status(401).json({ error: 'No OpenRouter API key' });
                upstreamUrl = 'https://openrouter.ai/api/v1/chat/completions';
                headers['Authorization'] = bearer;
                headers['HTTP-Referer'] = 'https://codeai.studio';
                headers['X-Title'] = 'CodeAI Studio';
                upstreamBody = { ...body };
                delete upstreamBody.provider;
                break;
            }
            case 'gemini': {
                const apiKey = body.apiKey || config.geminiApiKey;
                if (!apiKey)
                    return res.status(401).json({ error: 'No Gemini API key' });
                const model = body.model;
                upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
                upstreamBody = body.body ?? {};
                break;
            }
        }
        const response = await fetch(upstreamUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(upstreamBody),
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
        const ms = Date.now() - start;
        console.log(`[AI Proxy] provider=${provider} model=${body.model} status=${response.status} latency_ms=${ms}`);
    }
    catch (err) {
        const ms = Date.now() - start;
        const message = err instanceof Error ? err.message : 'Proxy error';
        console.error(`[AI Proxy] provider=${provider} error="${message}" latency_ms=${ms}`);
        res.status(500).json({ error: message });
    }
});
