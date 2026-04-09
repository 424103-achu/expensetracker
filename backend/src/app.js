import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import settlementRoutes from "./routes/settlementRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

const normalizeOrigin = (origin) => origin.replace(/\/$/, "");

const allowedOrigins = (
  process.env.CLIENT_URLS
    ? process.env.CLIENT_URLS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [process.env.CLIENT_URL || "http://localhost:5173"]
).map(normalizeOrigin);

app.use(cors({
  origin(origin, callback) {
    // Allow tools/curl requests that have no Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
}));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS policy blocked this origin" });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
