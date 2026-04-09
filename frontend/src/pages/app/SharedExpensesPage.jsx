import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import { getRealtimeSocket } from "../../realtime/socket";
import { useAuth } from "../../hooks/useAuth";

function SharedExpensesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  const load = () => {
    api.get("/expenses/shared/list").then((res) => setRows(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket(user?.uid);
    if (!socket) return;

    const reload = () => {
      load();
    };

    socket.on("settlement:update", reload);
    socket.on("shared:update", reload);
    socket.on("transaction:update", reload);
    socket.on("chat:message", reload);

    return () => {
      socket.off("settlement:update", reload);
      socket.off("shared:update", reload);
      socket.off("transaction:update", reload);
      socket.off("chat:message", reload);
    };
  }, [user?.uid]);

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
