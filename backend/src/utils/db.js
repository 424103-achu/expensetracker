import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool, types } = pkg;

types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432)
});

pool.on("error", (err) => {
  console.error("Unexpected PG error", err);
});

export default pool;
