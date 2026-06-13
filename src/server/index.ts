import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import net from 'net';
import { config } from './config';
import { filesRouter } from './routes/files';
import { aiRouter } from './routes/ai';
import { terminalRouter } from './routes/terminal';
import { gitRouter } from './routes/git';
import { githubRouter } from './routes/github';
import { authRouter } from './routes/auth';
import { agentRouter } from './routes/agent-loop';
import { aiUnifiedRouter } from './routes/ai-unified';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Security middleware
const isProd = config.nodeEnv === 'production';
app.use(helmet({
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: [
            "'self'",
            'ws://localhost:3001',
            'http://localhost:3001',
            'https://api.openai.com',
            'https://api.anthropic.com',
            'https://generativelanguage.googleapis.com',
            'https://integrate.api.nvidia.com',
            'https://openrouter.ai',
          ],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      }
    : false,
}));
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// API routes
app.use('/api/files', filesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-unified', aiUnifiedRouter);
app.use('/api/terminal', terminalRouter);
app.use('/api/git', gitRouter);
app.use('/api/github', githubRouter);
app.use('/api/auth', authRouter);
app.use('/api/ai/agent', agentRouter);

// Static files (production) — serve built client from dist
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '2.0.0', uptime: process.uptime() });
});

// WebSocket server for terminal streaming and hot-reload
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch {
      // ignore malformed messages
    }
  });
});

// Start server with port fallback
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function listenWithFallback(preferred: number) {
  const candidates = [preferred, preferred + 1, preferred + 2, preferred + 3, preferred + 4];
  let port = preferred;
  for (const p of candidates) {
    if (await isPortFree(p)) { port = p; break; }
  }
  server.listen(port, () => {
    console.log(`[CodeAI Server] Running on http://localhost:${port}`);
    console.log(`[CodeAI Server] Environment: ${config.nodeEnv}`);
  });
}

listenWithFallback(config.port).catch(() => {
  server.listen(config.port);
});

export { app, server, wss };
