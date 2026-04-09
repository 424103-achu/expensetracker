import pool from "../utils/db.js";

function buildTransactionQueryParts(uid, { search, type, sortOrder = "DESC" }) {
  const direction = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";
  const params = [uid];
  const filters = [];

  if (type === "expense" || type === "repayment" || type === "shared_share") {
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
        CONCAT('exp-', e.expense_id)::text AS transaction_id,
        e.expense_date AS date,
        e.title,
        c.name AS category,
        e.amount,
        e.payment_mode,
        e.notes,
        e.is_shared,
        'self'::text AS role
      FROM expenses e
      JOIN categories c ON c.id = e.category_id
      WHERE e.uid = $1

      UNION ALL

      SELECT
        'shared_share'::text AS transaction_type,
        CONCAT('share-', sp.participant_id)::text AS transaction_id,
        se.expense_date AS date,
        CONCAT('Shared expense share for ', se.title) AS title,
        c.name AS category,
        sp.assigned_cost AS amount,
        se.payment_mode,
        se.notes,
        TRUE AS is_shared,
        'participant'::text AS role
      FROM shared_participants sp
      JOIN shared_expenses se ON se.shared_expense_id = sp.shared_expense_id
      JOIN categories c ON c.id = se.category_id
      WHERE sp.uid = $1 AND se.owner_id <> $1

      UNION ALL

      SELECT
        'repayment'::text AS transaction_type,
        CONCAT('rep-', rt.transaction_id)::text AS transaction_id,
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

  return { direction, params, whereSql, baseSql };
}

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function toCsvDateText(value) {
  if (!value) {
    return "";
  }

  const raw = String(value).slice(0, 10);
  // Prefix with apostrophe so spreadsheet apps keep date as text.
  return `'${raw}`;
}

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
  const { direction, params, whereSql, baseSql } = buildTransactionQueryParts(uid, {
    search,
    type,
    sortOrder
  });

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

export async function exportTransactionsCsv(req, res) {
  const uid = req.user.uid;
  const { search, sortOrder = "DESC", type = "all" } = req.query;

  const { direction, params, whereSql, baseSql } = buildTransactionQueryParts(uid, {
    search,
    type,
    sortOrder
  });

  const exportSql = `
    SELECT *
    ${baseSql}
    ${whereSql}
    ORDER BY t.date ${direction}, t.transaction_id DESC
  `;

  const result = await pool.query(exportSql, params);

  const header = [
    "date",
    "transaction_type",
    "title",
    "category",
    "amount",
    "payment_mode",
    "role",
    "is_shared",
    "notes"
  ];

  const rows = result.rows.map((row) => [
    toCsvDateText(row.date),
    row.transaction_type,
    row.title,
    row.category,
    Number(row.amount || 0).toFixed(2),
    row.payment_mode,
    row.role,
    row.is_shared,
    row.notes || ""
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\n");

  const dateTag = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=transactions-${dateTag}.csv`);
  return res.status(200).send(`\uFEFF${csv}`);
}
