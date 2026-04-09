import express from "express";
import * as chatController from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/conversations", chatController.getConversations);
router.get("/conversations/search", chatController.searchConversations);
// TODO: change to start-conversation
router.post("/startConversation", chatController.startConversation);

router.get("/conversations/:id/messages", chatController.getMessagesByConversationId);
router.post("/conversations/:id/userMessage", chatController.addUserMessageToConversation);
router.put("/conversations/:id/folder", chatController.moveConversationToFolder);
router.get("/conversations/:id/shares", chatController.getConversationShares);
router.post("/conversations/:id/share", chatController.shareConversation);
router.delete("/conversations/:id/share/:sharedWithUserId", chatController.revokeConversationShare);

router.get("/folders", chatController.getAllFolders);
router.post("/folders", chatController.createFolder);
router.put("/folders/:id", chatController.updateFolder);
router.delete("/folders/:id", chatController.deleteFolder);
router.get("/folders/:id/conversations", chatController.getConversationsByFolder);

// Edit a message in a conversation
// router.put('/conversations/:conversationId/messages/:messageId', (req, res) => {
// });

export { router };
