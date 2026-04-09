import pool from "../utils/db.js";

const COMBINED_SPEND_CTE = `
  WITH combined_spend AS (
    SELECT
      e.expense_date,
      e.category_id,
      e.owner_share AS amount
    FROM expenses e
    WHERE e.uid = $1

    UNION ALL

    SELECT
      se.expense_date,
      se.category_id,
      sp.assigned_cost AS amount
    FROM shared_participants sp
    JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
    WHERE sp.uid = $1
      AND se.owner_id <> $1
  )
`;

export async function getDashboard(req, res) {
  const uid = req.user.uid;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const [summary, yearTotal, txCount, highestCategory, pieSplit, sixMonths, daily, recent] = await Promise.all([
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT COALESCE(SUM(amount), 0) AS month_total
       FROM combined_spend
       WHERE TO_CHAR(expense_date, 'YYYY-MM') = $2`,
      [uid, month]
    ),
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT COALESCE(SUM(amount), 0) AS year_total
       FROM combined_spend
       WHERE TO_CHAR(expense_date, 'YYYY') = $2`,
      [uid, month.slice(0, 4)]
    ),
    pool.query(
      `SELECT (
          (SELECT COUNT(*) FROM expenses WHERE uid = $1)
          +
          (SELECT COUNT(*)
             FROM shared_participants sp
             JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
             WHERE sp.uid = $1 AND se.owner_id <> $1)
          +
          (SELECT COUNT(*) FROM repayment_transactions WHERE from_uid = $1 OR to_uid = $1)
        )::int AS total_transactions`,
      [uid]
    ),
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT c.name, COALESCE(SUM(cs.amount), 0) AS amount
       FROM combined_spend cs
       JOIN categories c ON c.id = cs.category_id
       WHERE TO_CHAR(cs.expense_date, 'YYYY-MM') = $2
       GROUP BY c.name
       ORDER BY amount DESC
       LIMIT 1`,
      [uid, month]
    ),
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT c.name AS category, COALESCE(SUM(cs.amount), 0) AS amount
       FROM combined_spend cs
       JOIN categories c ON c.id = cs.category_id
       WHERE TO_CHAR(cs.expense_date, 'YYYY-MM') = $2
       GROUP BY c.name
       ORDER BY amount DESC`,
      [uid, month]
    ),
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month_key, COALESCE(SUM(amount), 0) AS total
       FROM combined_spend
       WHERE expense_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
       GROUP BY month_key
       ORDER BY month_key`,
      [uid]
    ),
    pool.query(
      `${COMBINED_SPEND_CTE}
       SELECT expense_date, COALESCE(SUM(amount), 0) AS total
       FROM combined_spend
       WHERE TO_CHAR(expense_date, 'YYYY-MM') = $2
       GROUP BY expense_date
       ORDER BY expense_date`,
      [uid, month]
    ),
    pool.query(
      `SELECT *
       FROM (
         SELECT
           e.expense_date AS date,
           e.title,
           e.owner_share AS amount,
           e.is_shared,
           c.name AS category,
           e.payment_mode,
           'expense' AS transaction_type
         FROM expenses e
         JOIN categories c ON c.id = e.category_id
         WHERE e.uid = $1

         UNION ALL

         SELECT
           DATE(rt.created_at) AS date,
           CASE
             WHEN rt.from_uid = $1 THEN CONCAT('Repayment to ', u_to.username, ' for ', se.title)
             ELSE CONCAT('Repayment from ', u_from.username, ' for ', se.title)
           END AS title,
           rt.amount,
           TRUE AS is_shared,
           'Settlement' AS category,
           rt.payment_mode,
           'repayment' AS transaction_type
         FROM repayment_transactions rt
         JOIN shared_expenses se ON se.shared_expense_id = rt.shared_expense_id
         JOIN users u_from ON u_from.uid = rt.from_uid
         JOIN users u_to ON u_to.uid = rt.to_uid
         WHERE rt.from_uid = $1 OR rt.to_uid = $1
       ) recent
       ORDER BY date DESC
       LIMIT 5`,
      [uid]
    )
  ]);

  return res.json({
    currentMonthTotal: Number(summary.rows[0].month_total || 0),
    yearTotal: Number(yearTotal.rows[0].year_total || 0),
    totalTransactions: Number(txCount.rows[0].total_transactions || 0),
    highestCategory: highestCategory.rows[0]?.name || "N/A",
    pie: pieSplit.rows.map((r) => ({ category: r.category, amount: Number(r.amount) })),
    monthlyBar: sixMonths.rows.map((r) => ({ month: r.month_key, total: Number(r.total) })),
    dailyLine: daily.rows.map((r) => ({ date: r.expense_date, total: Number(r.total) })),
    recentTransactions: recent.rows.map((r) => ({ ...r, amount: Number(r.amount) }))
  });
}
