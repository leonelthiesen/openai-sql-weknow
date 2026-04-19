import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { router as chatRoutes } from "./routes/chat.routes";
import * as jobController from "./controllers/job.controller";
import bodyParser from "body-parser";
import cors from "cors";
import { checkDatabaseConnection, sql } from "./db";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.send("Servidor está rodando!");
});

function readQueryUserId(req: Request): string | undefined {
  const candidates = [req.query.userId, req.query.user_id, req.query["x-user-id"]];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

const authenticateApiUser = async (req: Request, res: Response, next: NextFunction) => {
  // EventSource does not support custom headers in browsers, so we also accept userId via query.
  const headerUserId = req.header("x-user-id")?.trim();
  const queryUserId = readQueryUserId(req);
  const userId = headerUserId ?? queryUserId;

  if (!userId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  req.authenticatedUserId = userId;

  try {
    await sql`
      insert into app_users (id)
      values (${userId})
      on conflict (id) do nothing
    `;
    return next();
  } catch (error: unknown) {
    console.error("Falha ao validar usuário autenticado:", error);
    return res.status(500).json({ message: "Erro ao autenticar usuário." });
  }
};

app.use("/api/chat", authenticateApiUser);

app.use("/api/chat", chatRoutes);

// Compatibility aliases for frontend clients using /api/jobs instead of /api/chat/jobs
app.get("/api/jobs/:jobId/events", authenticateApiUser, jobController.getJobEvents);
app.get("/api/jobs/:jobId", authenticateApiUser, jobController.getJobStatus);

async function startServer(): Promise<void> {
  await checkDatabaseConnection();

  app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Falha ao conectar no PostgreSQL:", error);
  process.exit(1);
});
