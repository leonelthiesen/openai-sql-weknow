const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('Servidor está rodando!');
});

// rotas da API chat
const chatRouter = require('./routes/chat');
app.use('/api/chat', chatRouter);

app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
});


