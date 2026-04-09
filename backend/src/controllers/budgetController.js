import pool from "../utils/db.js";

export async function getBudgets(req, res) {
  const uid = req.user.uid;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const result = await pool.query(
    `SELECT
      c.id AS category_id,
      c.name AS category,
      mb.threshold,
      COALESCE(spent.total_spent, 0) AS total_spent
     FROM categories c
     LEFT JOIN monthly_budgets mb
       ON mb.category_id = c.id AND mb.uid = $1 AND mb.month_key = $2
     LEFT JOIN (
       SELECT category_id, SUM(owner_share) AS total_spent
       FROM expenses
       WHERE uid = $1 AND TO_CHAR(expense_date, 'YYYY-MM') = $2
       GROUP BY category_id
     ) spent ON spent.category_id = c.id
     ORDER BY c.id`,
    [uid, month]
  );

  return res.json(result.rows.map((row) => {
    const threshold = row.threshold ? Number(row.threshold) : null;
    const totalSpent = Number(row.total_spent);
    let status = "no-budget";

    if (threshold) {
      const pct = (totalSpent / threshold) * 100;
      if (pct < 60) status = "green";
      else if (pct <= 90) status = "yellow";
      else status = "red";
    }

    return {
      ...row,
      threshold,
      total_spent: totalSpent,
      month,
      status
    };
  }));
}

export async function upsertBudget(req, res) {
  const uid = req.user.uid;
  const { categoryId, threshold, month } = req.body;

  if (!categoryId || !threshold || !month) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  await pool.query(
    `INSERT INTO monthly_budgets (uid, category_id, month_key, threshold)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uid, category_id, month_key)
     DO UPDATE SET threshold = EXCLUDED.threshold, updated_at = NOW()`,
    [uid, Number(categoryId), month, Number(threshold)]
  );

  return res.json({ message: "Budget updated" });
}
