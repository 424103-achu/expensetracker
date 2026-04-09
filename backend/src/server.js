import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  const hostForLog = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Expense tracker backend running on http://${hostForLog}:${PORT}`);
});
