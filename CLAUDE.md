# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run in development mode with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output
npm run type-check   # TypeScript type checking without emit
npm test             # Run tests with vitest
npm run test -- src/services/weknow.service.test.ts  # Run a single test file
```

## Architecture

Express.js 5 + TypeScript API that converts natural language (Portuguese) into structured SQL queries via the OpenAI Responses API with tool calling, targeting the WeKnow analytics platform.

**Request flow:**
1. User sends a natural language question → `POST /api/chat/conversations/:id/userMessage`
2. Controller reconstructs full conversation history (replaying tool calls) and calls OpenAI
3. OpenAI uses `tool_choice: "required"` to always call one of two tools: `execute_query` or `ask_followup`
4. Response is stored in-memory and returned to the client

**Layered structure:**
- `src/routes/` → `src/controllers/` → `src/services/`
- All data stored in-memory (no database writes for conversations)
- `src/db.ts` exists for PostgreSQL but is not actively used in the main flow

**Key files:**
- `src/constants.ts` — System prompt (`MODEL_INSTRUCTIONS`), TypeScript types for OpenAI response schema
- `src/services/open-ai.service.ts` — Calls `openai.responses.create()` with reasoning effort `"minimal"`, model `gpt-5-mini-2025-08-07`
- `src/controllers/chat.controller.ts` — `buildOpenAIInput()` reconstructs multi-turn context by replaying stored tool calls
- `data/llm-tool-definitions.json` — Tool definitions for `execute_query` and `ask_followup`
- `src/services/weknow.service.ts` — WeKnow REST API client with SHA512 auth and in-memory metadata caching (not yet in main flow)

**Tools (`data/llm-tool-definitions.json`):**
- `execute_query` — Generates a SQL SELECT query, selects render type (`CHART`/`TABLE`/`TEXT`), optionally produces Apache ECharts v6 JSON config
- `ask_followup` — Requests clarification with a Portuguese message and follow-up question suggestions

**Render types:** `CHART` (ECharts v6 config), `TABLE` (structured data), `TEXT` (summary/aggregated value)

## Code Style

- TypeScript strict mode, ES Modules (`"type": "module"`), target ES2022
- camelCase for variables/functions, PascalCase for types/interfaces
- Async/await throughout; no callbacks
- User-facing text in Portuguese
- Diacritic-normalized search for Portuguese strings (see `utils/utils.ts`)

## Environment

Copy `.env.sample` to `.env`. Required: `OPENAI_API_KEY`. Optional: `PORT`, `WEKNOW_*` credentials, PostgreSQL connection details.
