import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getDebts,
  getSettlementSummary,
  markReceived,
  repayDebt
} from "../controllers/settlementController.js";

const router = Router();

router.get("/summary", verifyToken, getSettlementSummary);
router.get("/debts", verifyToken, getDebts);
router.post("/repay", verifyToken, repayDebt);
router.post("/received", verifyToken, markReceived);

export default router;
