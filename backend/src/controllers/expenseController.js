import pool from "../utils/db.js";
import { getMonthKey } from "../utils/month.js";
import { emitToUsers } from "../utils/realtime.js";

async function getCategoryIdByName(name) {
  const result = await pool.query("SELECT id FROM categories WHERE name = $1", [name]);
  return result.rows[0]?.id;
}

function isFutureDate(dateStr) {
  const input = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(input.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return input > today;
}

async function buildBudgetWarning(uid, categoryId, monthKey) {
  const spendResult = await pool.query(
    `SELECT COALESCE(SUM(owner_share), 0) AS spent
     FROM expenses
     WHERE uid = $1
       AND category_id = $2
       AND TO_CHAR(expense_date, 'YYYY-MM') = $3`,
    [uid, categoryId, monthKey]
  );

  const budgetResult = await pool.query(
    `SELECT threshold
     FROM monthly_budgets
     WHERE uid = $1 AND category_id = $2 AND month_key = $3`,
    [uid, categoryId, monthKey]
  );

  if (budgetResult.rowCount === 0) {
    return null;
  }

  const spent = Number(spendResult.rows[0].spent || 0);
  const threshold = Number(budgetResult.rows[0].threshold);
  const ratio = threshold === 0 ? 0 : (spent / threshold) * 100;

  if (ratio >= 100) {
    return { level: "danger", message: "Category budget exceeded" };
  }

  if (ratio >= 80) {
    return { level: "warning", message: "Category budget is close to limit" };
  }

  return null;
}

function normalizeParticipants(participants = [], requirePositiveCost = false) {
  return participants
    .map((p) => ({
      uid: Number(p.uid),
      assignedCost: Number(p.assignedCost || 0)
    }))
    .filter((p) => Number.isFinite(p.uid) && (requirePositiveCost ? p.assignedCost > 0 : true));
}

export async function listCategories(req, res) {
  const result = await pool.query("SELECT id, name FROM categories ORDER BY id ASC");
  return res.json(result.rows);
}

export async function addExpense(req, res) {
  const uid = req.user.uid;
  const {
    title,
    amount,
    category,
    expenseDate,
    paymentMode,
    notes,
    isShared,
    splitType,
    participants
  } = req.body;

  if (!title || !amount || !category || !expenseDate || !paymentMode) {
    return res.status(400).json({ message: "Missing required expense fields" });
  }

  if (isFutureDate(expenseDate)) {
    return res.status(400).json({ message: "Expense date cannot be in the future" });
  }

  const categoryId = await getCategoryIdByName(category);
  if (!categoryId) {
    return res.status(400).json({ message: "Invalid category" });
  }

  const totalAmount = Number(amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let ownerShare = totalAmount;
    let sharedExpenseId = null;
    let notifyUserIds = [uid];

    if (isShared) {
      const normalized = normalizeParticipants(participants, splitType === "custom");
      if (normalized.length === 0) {
        throw new Error("At least one participant required for shared expense");
      }
      notifyUserIds = [...new Set([uid, ...normalized.map((p) => p.uid)])];

      const insertedShared = await client.query(
        `INSERT INTO shared_expenses (owner_id, title, total_cost, category_id, expense_date, payment_mode, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING shared_expense_id`,
        [uid, title, totalAmount, categoryId, expenseDate, paymentMode, notes || null]
      );

      sharedExpenseId = insertedShared.rows[0].shared_expense_id;

      const everyone = [...normalized, { uid, assignedCost: 0 }];
      const uniqueIds = new Set(everyone.map((x) => x.uid));
      if (uniqueIds.size !== everyone.length) {
        throw new Error("Duplicate participant detected");
      }

      if (splitType === "equal") {
        const equalShare = Number((totalAmount / everyone.length).toFixed(2));
        let running = 0;
        for (let i = 0; i < everyone.length; i += 1) {
          if (i === everyone.length - 1) {
            everyone[i].assignedCost = Number((totalAmount - running).toFixed(2));
          } else {
            everyone[i].assignedCost = equalShare;
            running += equalShare;
          }
        }
      } else {
        const participantsTotal = normalized.reduce(
          (sum, p) => sum + Number(p.assignedCost || 0),
          0
        );

        if (participantsTotal - totalAmount > 0.01) {
          throw new Error("Participant shares cannot exceed total amount");
        }

        const payerShare = Number((totalAmount - participantsTotal).toFixed(2));
        const ownerRecord = everyone.find((p) => p.uid === uid);

        if (!ownerRecord || payerShare < 0) {
          throw new Error("Invalid custom split");
        }

        ownerRecord.assignedCost = payerShare;
      }

      for (const p of everyone) {
        const isOwner = p.uid === uid;
        if (isOwner) {
          ownerShare = p.assignedCost;
        }

        const pendingAmount = isOwner ? 0 : p.assignedCost;
        const status = isOwner ? "paid" : "pending";

        await client.query(
          `INSERT INTO shared_participants (shared_expense_id, uid, assigned_cost, pending_amount, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [sharedExpenseId, p.uid, p.assignedCost, pendingAmount, status]
        );
      }
    }

    const expenseResult = await client.query(
      `INSERT INTO expenses
       (uid, title, amount, owner_share, category_id, is_shared, shared_expense_id, expense_date, payment_mode, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING expense_id`,
      [
        uid,
        title,
        totalAmount,
        ownerShare,
        categoryId,
        Boolean(isShared),
        sharedExpenseId,
        expenseDate,
        paymentMode,
        notes || null
      ]
    );

    await client.query("COMMIT");

    if (sharedExpenseId) {
      emitToUsers(notifyUserIds, "shared:update", {
        sharedExpenseId,
        ownerUid: uid,
        action: "created"
      });
      emitToUsers(notifyUserIds, "settlement:update", {
        sharedExpenseId,
        ownerUid: uid,
        action: "created"
      });
      emitToUsers(notifyUserIds, "transaction:update", {
        sharedExpenseId,
        ownerUid: uid,
        action: "created"
      });
    } else {
      emitToUsers([uid], "transaction:update", {
        ownerUid: uid,
        action: "created"
      });
    }

    const warning = await buildBudgetWarning(uid, categoryId, getMonthKey(expenseDate));

    return res.status(201).json({
      expenseId: expenseResult.rows[0].expense_id,
      sharedExpenseId,
      warning
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: error.message || "Failed to add expense" });
  } finally {
    client.release();
  }
}

export async function listExpenses(req, res) {
  const uid = req.user.uid;
  const {
    page = 1,
    pageSize = 10,
    category,
    search,
    sortBy = "expense_date",
    sortOrder = "DESC"
  } = req.query;

  const offset = (Number(page) - 1) * Number(pageSize);
  const clauses = ["e.uid = $1"];
  const values = [uid];

  if (category && category !== "All") {
    values.push(category);
    clauses.push(`c.name = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(e.title ILIKE $${values.length} OR COALESCE(e.notes, '') ILIKE $${values.length})`);
  }

  const validSortMap = {
    date: "e.expense_date",
    amount: "e.amount",
    title: "e.title",
    category: "c.name",
    expense_date: "e.expense_date"
  };

  const orderBy = validSortMap[sortBy] || "e.expense_date";
  const orderDirection = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

  const whereSql = clauses.join(" AND ");

  const listQuery = `
    SELECT
      e.expense_id,
      e.title,
      e.amount,
      e.owner_share,
      e.is_shared,
      e.expense_date,
      e.payment_mode,
      e.notes,
      c.name AS category
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    WHERE ${whereSql}
    ORDER BY ${orderBy} ${orderDirection}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;

  const totalQuery = `
    SELECT
      COUNT(*)::int AS total_count,
      COALESCE(SUM(e.amount), 0) AS total_amount
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    WHERE ${whereSql}
  `;

  const listValues = [...values, Number(pageSize), offset];

  const [listResult, totalResult] = await Promise.all([
    pool.query(listQuery, listValues),
    pool.query(totalQuery, values)
  ]);

  return res.json({
    items: listResult.rows,
    totalCount: totalResult.rows[0].total_count,
    totalAmount: Number(totalResult.rows[0].total_amount),
    page: Number(page),
    pageSize: Number(pageSize)
  });
}

export async function updateExpense(req, res) {
  const uid = req.user.uid;
  const { expenseId } = req.params;
  const { title, amount, category, expenseDate, paymentMode, notes } = req.body;

  if (isFutureDate(expenseDate)) {
    return res.status(400).json({ message: "Expense date cannot be in the future" });
  }

  const categoryId = await getCategoryIdByName(category);
  if (!categoryId) {
    return res.status(400).json({ message: "Invalid category" });
  }

  const result = await pool.query(
    `UPDATE expenses
     SET title = $1,
         amount = $2,
         owner_share = CASE WHEN is_shared THEN owner_share ELSE $2 END,
         category_id = $3,
         expense_date = $4,
         payment_mode = $5,
         notes = $6,
         updated_at = NOW()
     WHERE expense_id = $7 AND uid = $8
     RETURNING expense_id`,
    [title, Number(amount), categoryId, expenseDate, paymentMode, notes || null, expenseId, uid]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Expense not found" });
  }

  emitToUsers([uid], "transaction:update", {
    ownerUid: uid,
    action: "updated",
    expenseId: Number(expenseId)
  });

  return res.json({ message: "Expense updated" });
}

export async function deleteExpense(req, res) {
  const uid = req.user.uid;
  const { expenseId } = req.params;

  const result = await pool.query(
    `DELETE FROM expenses
     WHERE expense_id = $1 AND uid = $2
     RETURNING shared_expense_id`,
    [expenseId, uid]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Expense not found" });
  }

  const sharedExpenseId = result.rows[0].shared_expense_id;
  let notifyUsers = [uid];
  if (sharedExpenseId) {
    const participantResult = await pool.query(
      `SELECT uid
       FROM shared_participants
       WHERE shared_expense_id = $1`,
      [sharedExpenseId]
    );
    notifyUsers = [...new Set([uid, ...participantResult.rows.map((r) => Number(r.uid))])];

    await pool.query("DELETE FROM shared_expenses WHERE shared_expense_id = $1", [sharedExpenseId]);
    emitToUsers(notifyUsers, "shared:update", {
      sharedExpenseId: Number(sharedExpenseId),
      ownerUid: uid,
      action: "deleted"
    });
    emitToUsers(notifyUsers, "settlement:update", {
      sharedExpenseId: Number(sharedExpenseId),
      ownerUid: uid,
      action: "deleted"
    });
  }

  emitToUsers(notifyUsers, "transaction:update", {
    ownerUid: uid,
    action: "deleted",
    expenseId: Number(expenseId),
    sharedExpenseId: sharedExpenseId ? Number(sharedExpenseId) : null
  });

  return res.json({ message: "Expense deleted" });
}

export async function listSharedExpenses(req, res) {
  const uid = req.user.uid;

  const result = await pool.query(
    `SELECT
      se.shared_expense_id,
      se.title,
      se.total_cost,
      se.owner_id,
      owner.username AS owner_username,
      sp.assigned_cost AS your_share,
      (sp.assigned_cost - sp.pending_amount) AS repaid,
      sp.pending_amount,
      sp.status,
      se.expense_date
     FROM shared_participants sp
     JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
     JOIN users owner ON owner.uid = se.owner_id
     WHERE sp.uid = $1
     ORDER BY se.expense_date DESC, se.shared_expense_id DESC`,
    [uid]
  );

  return res.json(result.rows);
}
