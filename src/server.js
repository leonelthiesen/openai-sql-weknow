import 'dotenv/config';
import express from 'express';
import chatRoutes from './routes/chat.routes.js';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('Servidor está rodando!');
});

app.use('/api/chat', chatRoutes);

app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
});
