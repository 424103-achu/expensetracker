import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { listTransactions } from "../controllers/transactionController.js";

const router = Router();

router.get("/", verifyToken, listTransactions);

export default router;
