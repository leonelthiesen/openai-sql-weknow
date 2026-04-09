import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { router as chatRoutes } from "./routes/chat.routes";
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

app.use("/api/chat", async (req: Request, res: Response, next: NextFunction) => {
  const rawUserId = req.header("x-user-id");
  const userId = rawUserId?.trim();

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
});

app.use("/api/chat", chatRoutes);

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
