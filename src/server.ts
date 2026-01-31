import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { router as chatRoutes } from "./routes/chat.routes";
import bodyParser from "body-parser";
import cors from "cors";

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

app.use("/api/chat", chatRoutes);

app.listen(port, () => {
  console.log(`Servidor iniciado na porta ${port}`);
});
