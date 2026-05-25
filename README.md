# CodeAI Studio v2

AI-powered code editor with multi-model support, built with professional architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS + Radix UI |
| State | Zustand (persisted) |
| Editor | Monaco Editor |
| Backend | Express + TypeScript |
| Desktop | Electron |
| Testing | Vitest + Playwright |

## Getting Started

```bash
# Install dependencies
npm install

# Start development (frontend + backend concurrently)
npm run dev

# Start Electron dev mode
npm run electron
```

## Project Structure

```
v2/
├── src/
│   ├── client/               # React frontend
│   │   ├── components/       # UI components (by feature)
│   │   │   ├── layout/       # Layout, Topbar, StatusBar
│   │   │   ├── sidebar/      # FileTree, Search, Git
│   │   │   ├── editor/       # Monaco, Tabs, PendingChanges
│   │   │   ├── chat/         # ChatPanel, ModelSelector
│   │   │   └── terminal/     # Terminal
│   │   ├── store/            # Zustand stores
│   │   ├── lib/              # Utilities, API client
│   │   ├── styles/           # Global CSS
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── server/               # Express backend
│   │   ├── routes/           # API route handlers
│   │   ├── config.ts         # Environment config
│   │   └── index.ts          # Server entry
│   └── shared/               # Shared types & constants
│       ├── types.ts
│       └── models.ts
├── electron/                 # Electron main process
├── tests/                    # Test files
├── public/                   # Static assets
├── .env.example              # Environment template
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Key Improvements over v1

- **Component architecture**: 25+ separate files vs 1 monolithic HTML
- **TypeScript**: Full type safety across client and server
- **Security**: Path validation, rate limiting, CORS restrictions, env-based secrets
- **State management**: Zustand with persistence, no global mutations
- **Resizable panels**: `react-resizable-panels` for IDE-like layout
- **Proper server**: Express with Helmet, no hardcoded paths
- **Testable**: Vitest for unit tests, Playwright for E2E
- **Modern tooling**: Vite (fast HMR), ESLint, Prettier, TailwindCSS

## Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint + fix |
| `npm run typecheck` | Type check without emit |
| `npm run electron` | Electron dev mode |
| `npm run electron:build` | Build desktop app |

## AI Models Supported

- **Claude** (Sonnet 4, Opus 4) — Anthropic
- **GPT-4o** — OpenAI
- **Gemini** (2.5 Flash, 2.5 Pro) — Google
- **DeepSeek** (V3, R1) — DeepSeek
- **Llama 3.1 405B** — NVIDIA NIM (free)
- **OpenRouter** (Qwen3, Grok, Kimi, etc.)

## License

MIT
