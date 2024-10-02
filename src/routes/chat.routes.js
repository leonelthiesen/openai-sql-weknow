import express from 'express';
import chatController from '../controllers/chat.controller.js';

const router = express.Router();

router.get('/conversations', chatController.getConversations);

router.post('/startConversation', chatController.startConversation);

router.get('/conversations/:id/messages', chatController.getMessagesByConversationId);

router.post('/conversations/:id/userMessage', chatController.addUserMessageToConversation);

// Edit a message in a conversation
// router.put('/conversations/:conversationId/messages/:messageId', (req, res) => {
// });

export default router;
