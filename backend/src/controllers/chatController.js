import pool from "../utils/db.js";
import { emitToUsers } from "../utils/realtime.js";

async function getChatAccess(sharedExpenseId, uid) {
  const result = await pool.query(
    `SELECT
       se.shared_expense_id,
       se.title,
       se.owner_id,
       owner.username AS owner_username,
       EXISTS (
         SELECT 1
         FROM shared_participants sp
         WHERE sp.shared_expense_id = se.shared_expense_id AND sp.uid = $2
       ) AS is_participant
     FROM shared_expenses se
     JOIN users owner ON owner.uid = se.owner_id
     WHERE se.shared_expense_id = $1`,
    [sharedExpenseId, uid]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  if (Number(row.owner_id) !== uid && !row.is_participant) {
    return { forbidden: true };
  }

  return {
    sharedExpenseId: Number(row.shared_expense_id),
    title: row.title,
    ownerId: Number(row.owner_id),
    ownerUsername: row.owner_username
  };
}

async function getChatUserIds(sharedExpenseId, ownerId) {
  const result = await pool.query(
    `SELECT uid
     FROM shared_participants
     WHERE shared_expense_id = $1`,
    [sharedExpenseId]
  );

  return [...new Set([ownerId, ...result.rows.map((r) => Number(r.uid))])];
}

async function isChatEnded(sharedExpenseId) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM shared_participants sp
       WHERE sp.shared_expense_id = $1
         AND sp.pending_amount > 0
     ) AS has_pending`,
    [sharedExpenseId]
  );

  const hasPending = result.rows[0]?.has_pending;
  return !hasPending;
}

export async function listChatThreads(req, res) {
  const uid = req.user.uid;

  const result = await pool.query(
    `SELECT
      se.shared_expense_id,
      se.title,
      se.owner_id,
      owner.username AS owner_username,
      NOT EXISTS (
        SELECT 1
        FROM shared_participants sp2
        WHERE sp2.shared_expense_id = se.shared_expense_id
          AND sp2.pending_amount > 0
      ) AS chat_ended,
      COALESCE(last_msg.created_at, se.created_at) AS last_activity_at,
      COALESCE(last_msg.message_content, '') AS last_message
     FROM shared_expenses se
     JOIN users owner ON owner.uid = se.owner_id
     LEFT JOIN LATERAL (
       SELECT m.message_content, m.created_at
       FROM shared_expense_messages m
       WHERE m.shared_expense_id = se.shared_expense_id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_msg ON TRUE
     WHERE se.owner_id = $1
        OR EXISTS (
          SELECT 1
          FROM shared_participants sp
          WHERE sp.shared_expense_id = se.shared_expense_id
            AND sp.uid = $1
        )
     ORDER BY last_activity_at DESC, se.shared_expense_id DESC`,
    [uid]
  );

  return res.json(result.rows.map((row) => ({
    shared_expense_id: Number(row.shared_expense_id),
    title: row.title,
    owner_id: Number(row.owner_id),
    owner_username: row.owner_username,
    chat_ended: row.chat_ended,
    last_activity_at: row.last_activity_at,
    last_message: row.last_message
  })));
}

export async function getChatMessages(req, res) {
  const uid = req.user.uid;
  const sharedExpenseId = Number(req.params.sharedExpenseId);

  const access = await getChatAccess(sharedExpenseId, uid);
  if (!access) {
    return res.status(404).json({ message: "Shared expense chat not found" });
  }
  if (access.forbidden) {
    return res.status(403).json({ message: "Not allowed to access this chat" });
  }

  const chatEnded = await isChatEnded(sharedExpenseId);

  const result = await pool.query(
    `SELECT
      m.message_id,
      m.shared_expense_id,
      m.sender_uid,
      sender.username AS sender_username,
      m.message_content,
      m.is_deleted,
      m.created_at,
      m.updated_at
     FROM shared_expense_messages m
     JOIN users sender ON sender.uid = m.sender_uid
     WHERE m.shared_expense_id = $1
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [sharedExpenseId]
  );

  return res.json({
    chat: {
      shared_expense_id: access.sharedExpenseId,
      title: access.title,
      owner_id: access.ownerId,
      owner_username: access.ownerUsername,
      is_owner: access.ownerId === uid,
      chat_ended: chatEnded
    },
    messages: result.rows.map((row) => ({
      message_id: Number(row.message_id),
      shared_expense_id: Number(row.shared_expense_id),
      sender_uid: Number(row.sender_uid),
      sender_username: row.sender_username,
      message_content: row.message_content,
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      updated_at: row.updated_at,
      can_delete: access.ownerId === uid || Number(row.sender_uid) === uid
    }))
  });
}

export async function sendChatMessage(req, res) {
  const uid = req.user.uid;
  const sharedExpenseId = Number(req.params.sharedExpenseId);
  const message = String(req.body.message || "").trim();

  if (!message) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }

  const access = await getChatAccess(sharedExpenseId, uid);
  if (!access) {
    return res.status(404).json({ message: "Shared expense chat not found" });
  }
  if (access.forbidden) {
    return res.status(403).json({ message: "Not allowed to send message in this chat" });
  }

  const chatEnded = await isChatEnded(sharedExpenseId);
  if (chatEnded) {
    return res.status(400).json({ message: "Chat has ended because no debts are pending" });
  }

  const insertResult = await pool.query(
    `INSERT INTO shared_expense_messages (shared_expense_id, sender_uid, message_content)
     VALUES ($1, $2, $3)
     RETURNING message_id, shared_expense_id, sender_uid, message_content, is_deleted, created_at, updated_at`,
    [sharedExpenseId, uid, message]
  );

  const senderResult = await pool.query("SELECT username FROM users WHERE uid = $1", [uid]);
  const senderUsername = senderResult.rows[0]?.username || "user";

  const inserted = insertResult.rows[0];
  const payload = {
    message_id: Number(inserted.message_id),
    shared_expense_id: Number(inserted.shared_expense_id),
    sender_uid: Number(inserted.sender_uid),
    sender_username: senderUsername,
    message_content: inserted.message_content,
    is_deleted: inserted.is_deleted,
    created_at: inserted.created_at,
    updated_at: inserted.updated_at
  };

  const userIds = await getChatUserIds(sharedExpenseId, access.ownerId);
  emitToUsers(userIds, "chat:message", {
    shared_expense_id: sharedExpenseId,
    message: payload
  });

  return res.status(201).json(payload);
}

export async function deleteChatMessage(req, res) {
  const uid = req.user.uid;
  const sharedExpenseId = Number(req.params.sharedExpenseId);
  const messageId = Number(req.params.messageId);

  const access = await getChatAccess(sharedExpenseId, uid);
  if (!access) {
    return res.status(404).json({ message: "Shared expense chat not found" });
  }
  if (access.forbidden) {
    return res.status(403).json({ message: "Not allowed to modify this chat" });
  }

  const msgResult = await pool.query(
    `SELECT sender_uid, is_deleted
     FROM shared_expense_messages
     WHERE message_id = $1 AND shared_expense_id = $2`,
    [messageId, sharedExpenseId]
  );

  if (msgResult.rowCount === 0) {
    return res.status(404).json({ message: "Message not found" });
  }

  const msg = msgResult.rows[0];
  if (msg.is_deleted) {
    return res.json({ message: "Message already removed" });
  }

  const isOwner = access.ownerId === uid;
  const isSender = Number(msg.sender_uid) === uid;
  if (!isOwner && !isSender) {
    return res.status(403).json({ message: "Not allowed to delete this message" });
  }

  const replacement = isOwner
    ? "Message removed by expense owner"
    : "Message removed by sender";

  await pool.query(
    `UPDATE shared_expense_messages
     SET message_content = $1,
         is_deleted = TRUE,
         deleted_by = $2,
         updated_at = NOW()
     WHERE message_id = $3`,
    [replacement, uid, messageId]
  );

  const userIds = await getChatUserIds(sharedExpenseId, access.ownerId);
  emitToUsers(userIds, "chat:messageDeleted", {
    shared_expense_id: sharedExpenseId,
    message_id: messageId,
    message_content: replacement
  });

  return res.json({ message: "Message deleted" });
}
