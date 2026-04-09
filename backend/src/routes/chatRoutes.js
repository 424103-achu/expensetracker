import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  deleteChatMessage,
  getChatMessages,
  listChatThreads,
  sendChatMessage
} from "../controllers/chatController.js";

const router = Router();

router.get("/", verifyToken, listChatThreads);
router.get("/:sharedExpenseId/messages", verifyToken, getChatMessages);
router.post("/:sharedExpenseId/messages", verifyToken, sendChatMessage);
router.delete("/:sharedExpenseId/messages/:messageId", verifyToken, deleteChatMessage);

export default router;
