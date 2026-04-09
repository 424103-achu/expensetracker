import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { getBudgets, upsertBudget } from "../controllers/budgetController.js";

const router = Router();

router.get("/", verifyToken, getBudgets);
router.post("/", verifyToken, upsertBudget);

export default router;
