import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  addExpense,
  deleteExpense,
  listCategories,
  listExpenses,
  listSharedExpenses,
  updateExpense
} from "../controllers/expenseController.js";

const router = Router();

router.get("/categories", verifyToken, listCategories);
router.get("/shared/list", verifyToken, listSharedExpenses);
router.post("/", verifyToken, addExpense);
router.get("/", verifyToken, listExpenses);
router.put("/:expenseId", verifyToken, updateExpense);
router.delete("/:expenseId", verifyToken, deleteExpense);

export default router;
