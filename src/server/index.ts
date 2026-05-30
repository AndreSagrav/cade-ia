import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config } from './config';
import { filesRouter } from './routes/files';
import { aiRouter } from './routes/ai';
import { terminalRouter } from './routes/terminal';
import { gitRouter } from './routes/git';
import { githubRouter } from './routes/github';
import { authRouter } from './routes/auth';
import { agentRouter } from './routes/agent-loop';

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.nodeEnv === 'development' ? 999999 : config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// API routes
app.use('/api/files', filesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/terminal', terminalRouter);
app.use('/api/git', gitRouter);
app.use('/api/github', githubRouter);
app.use('/api/auth', authRouter);
app.use('/api/ai/agent', agentRouter);

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

// Start server
server.listen(config.port, () => {
  console.log(`[CodeAI Server] Running on http://localhost:${config.port}`);
  console.log(`[CodeAI Server] Environment: ${config.nodeEnv}`);
});

export { app, server, wss };
