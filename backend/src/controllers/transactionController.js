import pool from "../utils/db.js";

export async function listTransactions(req, res) {
  const uid = req.user.uid;
  const {
    page = 1,
    pageSize = 15,
    search,
    sortOrder = "DESC",
    type = "all"
  } = req.query;

  const offset = (Number(page) - 1) * Number(pageSize);
  const direction = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

  const params = [uid];
  const filters = [];

  if (type === "expense" || type === "repayment") {
    params.push(type);
    filters.push(`t.transaction_type = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(t.title ILIKE $${params.length} OR COALESCE(t.notes, '') ILIKE $${params.length})`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const baseSql = `
    FROM (
      SELECT
        'expense'::text AS transaction_type,
        e.expense_id::text AS transaction_id,
        e.expense_date AS date,
        e.title,
        c.name AS category,
        e.amount,
        e.payment_mode,
        e.notes,
        e.is_shared,
        CASE WHEN e.uid = $1 THEN 'self' ELSE 'other' END AS role
      FROM expenses e
      JOIN categories c ON c.id = e.category_id
      WHERE e.uid = $1

      UNION ALL

      SELECT
        'repayment'::text AS transaction_type,
        rt.transaction_id::text AS transaction_id,
        DATE(rt.created_at) AS date,
        CASE
          WHEN rt.from_uid = $1 THEN CONCAT('Repayment to ', u_to.username, ' for ', se.title)
          ELSE CONCAT('Repayment from ', u_from.username, ' for ', se.title)
        END AS title,
        'Settlement'::text AS category,
        rt.amount,
        rt.payment_mode,
        rt.notes,
        TRUE AS is_shared,
        CASE WHEN rt.from_uid = $1 THEN 'paid' ELSE 'received' END AS role
      FROM repayment_transactions rt
      JOIN shared_expenses se ON se.shared_expense_id = rt.shared_expense_id
      JOIN users u_from ON u_from.uid = rt.from_uid
      JOIN users u_to ON u_to.uid = rt.to_uid
      WHERE rt.from_uid = $1 OR rt.to_uid = $1
    ) t
  `;

  const listSql = `
    SELECT *
    ${baseSql}
    ${whereSql}
    ORDER BY t.date ${direction}, t.transaction_id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total_count, COALESCE(SUM(t.amount), 0) AS total_amount
    ${baseSql}
    ${whereSql}
  `;

  const listParams = [...params, Number(pageSize), offset];

  const [listResult, countResult] = await Promise.all([
    pool.query(listSql, listParams),
    pool.query(countSql, params)
  ]);

  return res.json({
    items: listResult.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
    totalCount: countResult.rows[0].total_count,
    totalAmount: Number(countResult.rows[0].total_amount || 0),
    page: Number(page),
    pageSize: Number(pageSize)
  });
}
