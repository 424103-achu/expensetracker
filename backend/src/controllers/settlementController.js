import pool from "../utils/db.js";

export async function getSettlementSummary(req, res) {
  const uid = req.user.uid;

  const oweResult = await pool.query(
    `SELECT COALESCE(SUM(pending_amount), 0) AS total
     FROM shared_participants sp
     JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
     WHERE sp.uid = $1
       AND se.owner_id <> $1
       AND sp.pending_amount > 0`,
    [uid]
  );

  const owedResult = await pool.query(
    `SELECT COALESCE(SUM(sp.pending_amount), 0) AS total
     FROM shared_expenses se
     JOIN shared_participants sp ON sp.shared_expense_id = se.shared_expense_id
     WHERE se.owner_id = $1
       AND sp.uid <> $1
       AND sp.pending_amount > 0`,
    [uid]
  );

  const owe = Number(oweResult.rows[0].total || 0);
  const owed = Number(owedResult.rows[0].total || 0);

  return res.json({
    owe,
    owed,
    net: Number((owed - owe).toFixed(2))
  });
}

export async function getDebts(req, res) {
  const uid = req.user.uid;

  const owe = await pool.query(
    `SELECT
      se.shared_expense_id,
      se.title,
      owner.uid AS counterparty_uid,
      owner.username AS counterparty_username,
      sp.assigned_cost,
      sp.pending_amount,
      sp.status,
      'owe' AS direction
     FROM shared_participants sp
     JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
     JOIN users owner ON owner.uid = se.owner_id
     WHERE sp.uid = $1
       AND se.owner_id <> $1
     ORDER BY se.expense_date DESC`,
    [uid]
  );

  const owed = await pool.query(
    `SELECT
      se.shared_expense_id,
      se.title,
      debtor.uid AS counterparty_uid,
      debtor.username AS counterparty_username,
      sp.assigned_cost,
      sp.pending_amount,
      sp.status,
      'owed' AS direction
     FROM shared_expenses se
     JOIN shared_participants sp ON sp.shared_expense_id = se.shared_expense_id
     JOIN users debtor ON debtor.uid = sp.uid
     WHERE se.owner_id = $1
       AND sp.uid <> $1
     ORDER BY se.expense_date DESC`,
    [uid]
  );

  return res.json({
    owe: owe.rows,
    owed: owed.rows
  });
}

export async function repayDebt(req, res) {
  const uid = req.user.uid;
  const { sharedExpenseId, amount, paymentMode, notes } = req.body;

  const repayAmount = Number(amount);
  if (!sharedExpenseId || !repayAmount || repayAmount <= 0) {
    return res.status(400).json({ message: "Invalid repayment input" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const participantResult = await client.query(
      `SELECT sp.pending_amount, se.owner_id, se.title
       FROM shared_participants sp
       JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
       WHERE sp.shared_expense_id = $1 AND sp.uid = $2`,
      [sharedExpenseId, uid]
    );

    if (participantResult.rowCount === 0) {
      throw new Error("Debt record not found");
    }

    const row = participantResult.rows[0];
    if (row.owner_id === uid) {
      throw new Error("Owner cannot repay this debt");
    }

    const pending = Number(row.pending_amount);
    if (repayAmount > pending) {
      throw new Error("Repayment amount cannot exceed pending amount");
    }

    const newPending = Number((pending - repayAmount).toFixed(2));
    const newStatus = newPending === 0 ? "completed" : "pending";

    await client.query(
      `UPDATE shared_participants
       SET pending_amount = $1,
           status = $2,
           updated_at = NOW()
       WHERE shared_expense_id = $3 AND uid = $4`,
      [newPending, newStatus, sharedExpenseId, uid]
    );

    await client.query(
      `INSERT INTO repayment_transactions
       (shared_expense_id, from_uid, to_uid, amount, payment_mode, notes, transaction_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'repay')`,
      [sharedExpenseId, uid, row.owner_id, repayAmount, paymentMode || "cash", notes || null]
    );

    await client.query(
      `INSERT INTO notifications (uid, message)
       VALUES ($1, $2)`,
      [row.owner_id, `Repayment received: ${repayAmount} for ${row.title}`]
    );

    await client.query("COMMIT");
    return res.json({ message: "Repayment recorded", pending: newPending, status: newStatus });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: error.message || "Repayment failed" });
  } finally {
    client.release();
  }
}

export async function markReceived(req, res) {
  const uid = req.user.uid;
  const { sharedExpenseId, debtorUid, amount, paymentMode, notes } = req.body;

  const incomingAmount = Number(amount);
  if (!sharedExpenseId || !debtorUid || !incomingAmount || incomingAmount <= 0) {
    return res.status(400).json({ message: "Invalid received input" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      "SELECT owner_id, title FROM shared_expenses WHERE shared_expense_id = $1",
      [sharedExpenseId]
    );

    if (ownerCheck.rowCount === 0 || ownerCheck.rows[0].owner_id !== uid) {
      throw new Error("Only expense owner can mark received");
    }

    const debtResult = await client.query(
      `SELECT pending_amount
       FROM shared_participants
       WHERE shared_expense_id = $1 AND uid = $2`,
      [sharedExpenseId, debtorUid]
    );

    if (debtResult.rowCount === 0) {
      throw new Error("Participant debt not found");
    }

    const pending = Number(debtResult.rows[0].pending_amount);
    if (incomingAmount > pending) {
      throw new Error("Received amount cannot exceed pending amount");
    }

    const newPending = Number((pending - incomingAmount).toFixed(2));
    const status = newPending === 0 ? "completed" : "pending";

    await client.query(
      `UPDATE shared_participants
       SET pending_amount = $1,
           status = $2,
           updated_at = NOW()
       WHERE shared_expense_id = $3 AND uid = $4`,
      [newPending, status, sharedExpenseId, debtorUid]
    );

    await client.query(
      `INSERT INTO repayment_transactions
       (shared_expense_id, from_uid, to_uid, amount, payment_mode, notes, transaction_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'received')`,
      [sharedExpenseId, debtorUid, uid, incomingAmount, paymentMode || "cash", notes || null]
    );

    await client.query("COMMIT");
    return res.json({ message: "Received payment recorded", pending: newPending, status });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: error.message || "Failed to mark received" });
  } finally {
    client.release();
  }
}
