# OpenAI SQL WeKnow - Copilot Instructions

## System Architecture

This is a **natural language to SQL translator** with WeKnow BI platform integration. The pipeline is:

1. User natural language → OpenAI (GPT-3.5) → SQLite-compatible SQL
2. SQL → AST (via node-sql-parser) → WeKnow grid/chart config JSON
3. WeKnow API executes the config to render visualizations

**Critical constraint**: SQL must query a single flat table called `data` with no JOINs, WITH, or UNION clauses. Field operators between columns are restricted.

## Core Data Flow

- [chat.controller.js](src/controllers/chat.controller.js): Orchestrates the full pipeline (OpenAI → AST → WeKnow)
- [open-ai.service.js](src/services/open-ai.service.js): Calls OpenAI with system message + conversation history
- [ast-to-weknow.service.js](src/services/ast-to-weknow.service.js): Transforms SQL AST → WeKnow JSON configs (grids/charts)
- [weknow.service.js](src/services/weknow.service.js): Authenticates and executes WeKnow API calls; uses Puppeteer for rendering
- [chat.service.js](src/services/chat.service.js): In-memory conversation storage with mock data structure

## Key Patterns

### System Message Construction
Field lists from metadata are injected into `SYSTEM_MESSAGE` constant to constrain OpenAI's SQL generation. See [constants.js](src/constants.js) lines 1-5.

### AST Mapping
[ast-to-weknow.service.js](src/services/ast-to-weknow.service.js) maps SQL AST nodes to WeKnow's proprietary format:
- Aggregation functions → `WeknowAggFunctions` enum (COUNT, SUM, AVG, etc.)
- WHERE operators → `ValidWeknowOperators` (Contains, Equals, GreaterThan, etc.)
- Handles SELECT, WHERE, GROUP BY, HAVING, ORDER BY clauses
- Generates both table (`ObjectTypes.Table`) and chart (`ObjectTypes.Chart`) configs from same SQL

### Dual Config Generation
Controllers generate **both** grid and chart configs for every query. Chart rendering is conditional on `gridConfigAllowChartRender()` validation (checks for aggregations).

### ES Module Patterns
- Uses ES6 modules (`import`/`export`) throughout
- `node-sql-parser` requires CommonJS interop via `createRequire` (see [ast-to-weknow.service.js](src/services/ast-to-weknow.service.js) lines 2-4)
- All services export default objects with methods

## Environment Setup

1. Copy [sample.env](sample.env) to `.env` and configure:
   - `OPENAI_API_KEY`: Required for SQL generation
   - `PG*`: PostgreSQL connection (conversations storage)
   - `WEKNOW_*`: WeKnow API credentials and endpoints
   - `CHROME_EXECUTABLE_PATH`: For Puppeteer rendering
   - `METADATA_ID`: WeKnow metadata context

2. Run `npm install` (dependencies: express, openai, node-sql-parser, postgres, puppeteer-core)

## Development Workflow

- **Dev mode**: `npm run dev` (uses Node's `--watch-path=src` for hot reload)
- **Tests**: `npm test` (Vitest for service layer)
- **Test files**: [ast-to-weknow.service.test.js](src/services/ast-to-weknow.service.test.js), [sql-create-statement.service.test.js](src/services/sql-create-statement.service.test.js)

Test structure: Compare generated WeKnow configs against expected JSON snapshots for SQL inputs.

## API Endpoints

- `POST /api/chat/startConversation`: Creates conversation, generates SQL + configs
- `POST /api/chat/conversations/:id/userMessage`: Continues conversation thread
- `GET /api/chat/conversations`: Lists all conversations
- `GET /api/chat/conversations/:id/messages`: Retrieves conversation history

## Extending the System

### Adding New SQL Operators
Update mappings in [ast-to-weknow.service.js](src/services/ast-to-weknow.service.js):
- `AstOperatorToWeknow` for WHERE clause operators
- `AstAggFunctionToWeknow` for aggregation functions
- Add to `ValidWeknowOperators` enum if new to WeKnow

### Modifying WeKnow Configs
Base templates in [constants.js](src/constants.js): `baseGridConfig`, `baseChartConfig`. These are cloned and populated per request.

### Field Types
[sql-create-statement.service.js](src/services/sql-create-statement.service.js) defines `FieldType` enum (maps to database field types).

## Important Constraints

- **Single table queries only**: FROM clause must reference `data` table exclusively
- **No field arithmetic**: SQL operators like `*`, `+`, `-` between fields are disallowed
- **Metadata-driven**: Available fields come from `metadataFields` parameter in requests
- **Conversation context**: OpenAI receives full message history for contextual SQL generation
