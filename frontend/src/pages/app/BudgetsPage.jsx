import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";

function BudgetsPage() {
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const load = () => {
    api.get(`/budgets?month=${month}`).then((res) => setRows(res.data));
  };

  useEffect(load, [month]);

  const save = async (categoryId, threshold) => {
    setSavingId(categoryId);
    await api.post("/budgets", { categoryId, threshold: Number(threshold), month });
    setSavingId(null);
    load();
  };

  return (
    <AppLayout title="Monthly category budgets">
      <div className="panel p-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Spent</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Set / Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = row.threshold ? Math.min(100, Math.round((row.total_spent / row.threshold) * 100)) : 0;
              const color = row.status === "green" ? "bg-green-500" : row.status === "yellow" ? "bg-yellow-400" : row.status === "red" ? "bg-red-500" : "bg-zinc-600";

              return (
                <tr key={row.category_id}>
                  <td>{row.category}</td>
                  <td>{Number(row.total_spent).toFixed(2)}</td>
                  <td>{row.threshold ? Number(row.threshold).toFixed(2) : "No budget set"}</td>
                  <td>
                    <div className="w-48 h-2 rounded bg-zinc-700 overflow-hidden">
                      <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">{row.threshold ? `${pct}%` : "No budget is set"}</div>
                  </td>
                  <td>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = e.currentTarget.threshold.value;
                        save(row.category_id, val);
                      }}
                    >
                      <input name="threshold" type="number" step="0.01" className="input" placeholder="Threshold" defaultValue={row.threshold || ""} />
                      <button className="btn" disabled={savingId === row.category_id}>{savingId === row.category_id ? "Saving..." : "Save"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default BudgetsPage;
