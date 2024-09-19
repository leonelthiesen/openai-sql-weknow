const express = require('express');

const router = express.Router();

// Mock data for demonstration purposes
let conversations = [
    {
        id: 1,
        metadataId: 8,
        messages: [{
            id: 1,
            sender: 'user',
            text: 'contagem de vendas por empresa em ordem',
            timestamp: new Date()
        }, {
            id: 2,
            sender: 'bot',
            // text: 'Entendi, você quer ver a contagem de vendas por empresa em ordem, segue', // TODO: fazer com que o bot responda um texto junto com o SQL
            sql: `SELECT company_name, COUNT(*) AS total_vendas FROM data GROUP BY company_name ORDER BY total_vendas DESC;`,
            chartConfig: '',
            chartData: '',
            gridConfig: '',
            gridData: '',
            timestamp: new Date()
        }]
    },
    { id: 2, metadataId: 8, messages: [] }
];

// Get all conversations
router.get('/conversations', (req, res) => {
    res.json(conversations);
});

// Get a specific conversation by ID
router.get('/conversations/:id', (req, res) => {
    const conversation = conversations.find(c => c.id === parseInt(req.params.id));
    if (!conversation) return res.status(404).send('Conversation not found');
    res.json(conversation);
});

// Create a new conversation and await a response
router.post('/conversations', (req, res) => {
    const newConversation = {
        id: conversations.length + 1,
        messages: []
    };
    conversations.push(newConversation);
    res.status(201).json(newConversation);
});

// Add a message to a conversation
router.post('/conversations/:id/messages', (req, res) => {
    const conversation = conversations.find(c => c.id === parseInt(req.params.id));
    if (!conversation) return res.status(404).send('Conversation not found');

    const newMessage = {
        id: conversation.messages.length + 1,
        sender: req.body.sender,
        text: req.body.text,
        timestamp: new Date()
    };
    conversation.messages.push(newMessage);
    res.status(201).json(newMessage);
});

// Edit a message in a conversation
router.put('/conversations/:conversationId/messages/:messageId', (req, res) => {
    const conversation = conversations.find(c => c.id === parseInt(req.params.conversationId));
    if (!conversation) return res.status(404).send('Conversation not found');

    const message = conversation.messages.find(m => m.id === parseInt(req.params.messageId));
    if (!message) return res.status(404).send('Message not found');

    message.text = req.body.text;
    message.timestamp = new Date(); // Update timestamp to reflect the edit

    res.json(message);
});

module.exports = router;