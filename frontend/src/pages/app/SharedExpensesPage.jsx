import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";

function SharedExpensesPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/expenses/shared/list").then((res) => setRows(res.data));
  }, []);

  return (
    <AppLayout title="Shared expense ledger">
      <div className="panel p-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Total Amount</th>
              <th>Payer</th>
              <th>Your Share</th>
              <th>Repaid</th>
              <th>Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.shared_expense_id}>
                <td>{r.title}</td>
                <td>{Number(r.total_cost).toFixed(2)}</td>
                <td>{r.owner_username}</td>
                <td>{Number(r.your_share).toFixed(2)}</td>
                <td>{Number(r.repaid).toFixed(2)}</td>
                <td>{Number(r.pending_amount).toFixed(2)}</td>
                <td><span className="badge">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default SharedExpensesPage;
