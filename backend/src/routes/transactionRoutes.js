import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { exportTransactionsCsv, listTransactions } from "../controllers/transactionController.js";

const router = Router();

router.get("/export/csv", verifyToken, exportTransactionsCsv);
router.get("/", verifyToken, listTransactions);

export default router;
