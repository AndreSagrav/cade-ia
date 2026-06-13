import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() {
    const envPath = resolve(process.cwd(), '.env');
    const env = {};
    if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1)
                continue;
            const key = trimmed.slice(0, eqIndex).trim();
            const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
            env[key] = value;
        }
    }
    return env;
}
const fileEnv = loadEnv();
const env = { ...fileEnv, ...process.env };
// Inject loaded env vars into process.env so all modules can access them
for (const [key, value] of Object.entries(fileEnv)) {
    if (!process.env[key])
        process.env[key] = value;
}
export const config = {
    port: parseInt(env.PORT ?? '3001', 10),
    nodeEnv: env.NODE_ENV ?? 'development',
    // In Electron production, renderer runs on http://localhost:PORT (same-origin) or file://.
    // Keep defaults broad; server will also serve static client.
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3001,file://').split(','),
    rateLimitMax: parseInt(env.RATE_LIMIT_MAX ?? '100', 10),
    rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    // AI API Keys (from server env — more secure than client-side)
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    nvidiaApiKey: env.NVIDIA_API_KEY ?? '',
    deepseekApiKey: env.DEEPSEEK_API_KEY ?? '',
    openrouterApiKey: env.OPENROUTER_API_KEY ?? '',
    // Auth
    authUser: env.AUTH_USER ?? '',
    authPass: env.AUTH_PASS ?? '',
    // Supabase (server-side)
    supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    // Features
    enableTerminal: (env.NODE_ENV ?? 'development') !== 'production'
        ? true
        : (env.ENABLE_TERMINAL === '1'),
};
