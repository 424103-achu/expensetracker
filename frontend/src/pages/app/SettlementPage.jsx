import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import DebtModal from "../../components/DebtModal";
import { getRealtimeSocket } from "../../realtime/socket";
import { useAuth } from "../../hooks/useAuth";

function SettlementPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({ owe: 0, owed: 0, net: 0 });
  const [debts, setDebts] = useState({ owe: [], owed: [] });
  const [notifications, setNotifications] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    const [s, d, n] = await Promise.all([
      api.get("/settlements/summary"),
      api.get("/settlements/debts"),
      api.get("/users/notifications")
    ]);
    setSummary(s.data);
    setDebts(d.data);
    setNotifications(n.data);
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

    return () => {
      socket.off("settlement:update", reload);
      socket.off("shared:update", reload);
      socket.off("transaction:update", reload);
    };
  }, [user?.uid]);

  const onRepay = async ({ amount, paymentMode, notes }) => {
    if (!activeAction) return;
    try {
      setError("");
      if (activeAction.type === "repay") {
        await api.post("/settlements/repay", {
          sharedExpenseId: activeAction.row.shared_expense_id,
          amount,
          paymentMode,
          notes
        });
      } else {
        await api.post("/settlements/received", {
          sharedExpenseId: activeAction.row.shared_expense_id,
          debtorUid: activeAction.row.counterparty_uid,
          amount,
          paymentMode,
          notes
        });
      }
      setActiveAction(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed");
    }
  };

  return (
    <AppLayout title="Debts, repayments, and settlement summary">
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="panel p-4"><p className="text-zinc-400 text-sm">You Owe</p><h3 className="text-2xl text-red-400">{summary.owe.toFixed(2)}</h3></div>
        <div className="panel p-4"><p className="text-zinc-400 text-sm">You Are Owed</p><h3 className="text-2xl text-green-400">{summary.owed.toFixed(2)}</h3></div>
        <div className="panel p-4"><p className="text-zinc-400 text-sm">Net Balance</p><h3 className={`text-2xl ${summary.net >= 0 ? "text-green-400" : "text-red-400"}`}>{summary.net.toFixed(2)}</h3></div>
      </div>

      {error ? <div className="panel p-3 mb-4 text-red-300">{error}</div> : null}

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <section className="panel p-4">
          <h3 className="mb-3 text-red-300">Money You Owe</h3>
          <div className="space-y-2">
            {debts.owe.map((row) => (
              <div key={`${row.shared_expense_id}-${row.counterparty_uid}`} className="p-3 rounded-lg bg-zinc-900/60">
                <div className="flex justify-between"><span>{row.title}</span><span>{Number(row.pending_amount).toFixed(2)}</span></div>
                <div className="text-sm text-zinc-400">To: {row.counterparty_username}</div>
                {Number(row.pending_amount) > 0 ? (
                  <button className="btn mt-2" onClick={() => setActiveAction({ type: "repay", row })}>Repay</button>
                ) : (
                  <span className="badge mt-2 inline-flex">Completed</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-4">
          <h3 className="mb-3 text-green-300">Money Others Owe You</h3>
          <div className="space-y-2">
            {debts.owed.map((row) => (
              <div key={`${row.shared_expense_id}-${row.counterparty_uid}`} className="p-3 rounded-lg bg-zinc-900/60">
                <div className="flex justify-between"><span>{row.title}</span><span>{Number(row.pending_amount).toFixed(2)}</span></div>
                <div className="text-sm text-zinc-400">From: {row.counterparty_username}</div>
                {Number(row.pending_amount) > 0 ? (
                  <button className="btn mt-2" onClick={() => setActiveAction({ type: "received", row })}>Mark Received</button>
                ) : (
                  <span className="badge mt-2 inline-flex">Completed</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-4">
        <h3 className="mb-3">Notifications</h3>
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.notification_id} className={`p-3 rounded ${n.is_read ? "bg-zinc-800" : "bg-zinc-700"}`}>
              <p>{n.message}</p>
              <p className="text-xs text-zinc-400 mt-1">{n.created_at}</p>
            </div>
          ))}
        </div>
      </section>

      <DebtModal
        open={Boolean(activeAction)}
        title={activeAction?.type === "repay" ? "Repay Debt" : "Mark Payment Received"}
        onClose={() => setActiveAction(null)}
        onSubmit={onRepay}
      />
    </AppLayout>
  );
}

export default SettlementPage;
