import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { getDashboard } from "../controllers/dashboardController.js";

const router = Router();

router.get("/summary", verifyToken, getDashboard);

export default router;
