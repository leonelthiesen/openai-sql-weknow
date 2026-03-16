# Project Guidelines

## Overview

Express.js 5 + TypeScript API that converts natural language (Portuguese) into structured SQL queries via the OpenAI Responses API with tool calling, targeting the WeKnow analytics platform.

## Architecture

Layered MVC pattern: **Routes → Controllers → Services**

- `src/routes/` — Express route definitions
- `src/controllers/` — HTTP request/response handling, try/catch with 500 errors
- `src/services/` — Business logic (chat orchestration, OpenAI integration, WeKnow API)
- `src/types/` — TypeScript type declarations
- `src/utils/` — Shared utilities

Key services:
- **chat.service** — Conversation/folder management (in-memory), message reconstruction for multi-turn conversations
- **open-ai.service** — OpenAI Responses API with `tool_choice: "required"`, model `gpt-5-mini-2025-08-07`
- **weknow.service** — REST API client for metadata retrieval, SHA512 auth, in-memory caching

## Code Style

- **Language**: TypeScript with strict mode enabled
- **Module system**: ES Modules (`"type": "module"` in package.json)
- **Target**: ES2022
- **User-facing text**: Always in Portuguese (pt-BR)
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces
- **Calculated fields**: `cf_lowercase_with_underscores` naming convention
- **Error handling**: try/catch in controllers returning `res.status(500)` with Portuguese messages
- **Async**: async/await throughout, no raw Promises

## Build and Test

```bash
npm run dev              # Dev server with watch (tsx watch)
npm run build            # Compile TypeScript → dist/
npm run start            # Run compiled server
npm run type-check       # Type-check without emitting
npm run test             # Run Vitest
```

## Conventions

- **OpenAI tool calling**: Tools defined in `src/models/tool-definitions.ts`. Three tools: `execute_query` (generates SQL structure with render type CHART/TABLE/TEXT), `ask_followup` (request clarification), and `render_chart_config` (generate ECharts v6 JSON config)1
- **Message reconstruction**: Tool calls stored with IDs, reconstructed as `function_call` + `function_call_output` items for conversation context
- **Chart rendering**: Apache ECharts v6 JSON config
- **Search**: Diacritic-normalized for Portuguese characters
- **Environment**: Copy `sample.env` to `.env` — requires `OPENAI_API_KEY` and WeKnow credentials
- **Database**: PostgreSQL via `postgres` driver (configured but not yet actively used for persistence)
- **No auth layer**: No user authentication currently implemented
