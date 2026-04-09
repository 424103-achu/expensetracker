import pool from "../utils/db.js";
import { CURRENCIES } from "../constants/domain.js";

export async function searchUsers(req, res) {
  const q = (req.query.q || "").trim();

  if (!q) {
    return res.json([]);
  }

  const uid = req.user.uid;

  const result = await pool.query(
    `SELECT uid, name, username, email
     FROM users
     WHERE uid <> $1
       AND (
         username ILIKE $2
         OR email ILIKE $2
         OR name ILIKE $2
       )
     ORDER BY username ASC
     LIMIT 10`,
    [uid, `%${q}%`]
  );

  return res.json(result.rows);
}

export async function getCurrencies(req, res) {
  return res.json(CURRENCIES);
}

export async function getNotifications(req, res) {
  const uid = req.user.uid;

  const result = await pool.query(
    `SELECT notification_id, message, is_read, created_at
     FROM notifications
     WHERE uid = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [uid]
  );

  return res.json(result.rows);
}

export async function markNotificationRead(req, res) {
  const uid = req.user.uid;
  const { id } = req.params;

  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE notification_id = $1 AND uid = $2`,
    [id, uid]
  );

  return res.json({ message: "Notification marked as read" });
}
