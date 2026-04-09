import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../utils/db.js";
import { CURRENCIES } from "../constants/domain.js";

export async function register(req, res) {
  const { name, email, username, password, currencyPreference } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const currency = CURRENCIES.includes(currencyPreference)
    ? currencyPreference
    : "INR";

  try {
    const existing = await pool.query(
      "SELECT uid FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Email or username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await pool.query(
      `INSERT INTO users (name, email, username, password_hash, currency_preference)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING uid, name, email, username, currency_preference`,
      [name, email, username, passwordHash, currency]
    );

    const user = inserted.rows[0];
    const token = jwt.sign({ uid: user.uid }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.status(201).json({ user, token });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function login(req, res) {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

  try {
    const result = await pool.query(
      `SELECT uid, name, email, username, password_hash, currency_preference
       FROM users
       WHERE email = $1 OR username = $1`,
      [identifier]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ uid: user.uid }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.json({
      user: {
        uid: user.uid,
        name: user.name,
        email: user.email,
        username: user.username,
        currency_preference: user.currency_preference
      },
      token
    });
  } catch {
    return res.status(500).json({ message: "Login failed" });
  }
}

export function me(req, res) {
  return res.json({ user: req.user });
}
