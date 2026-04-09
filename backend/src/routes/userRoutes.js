import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getCurrencies,
  getNotifications,
  markNotificationRead,
  searchUsers
} from "../controllers/userController.js";

const router = Router();

router.get("/currencies", getCurrencies);
router.get("/search", verifyToken, searchUsers);
router.get("/notifications", verifyToken, getNotifications);
router.patch("/notifications/:id/read", verifyToken, markNotificationRead);

export default router;
