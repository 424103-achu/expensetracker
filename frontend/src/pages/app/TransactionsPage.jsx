import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import { getRealtimeSocket } from "../../realtime/socket";
import { useAuth } from "../../hooks/useAuth";

function TransactionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [filters, setFilters] = useState({ search: "", type: "all", sortOrder: "DESC" });

  const exportCsv = async () => {
    const params = new URLSearchParams({
      sortOrder: filters.sortOrder,
      type: filters.type
    });
    if (filters.search) params.set("search", filters.search);

    const res = await api.get(`/transactions/export/csv?${params.toString()}`, {
      responseType: "blob"
    });

    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "15",
      sortOrder: filters.sortOrder,
      type: filters.type
    });
    if (filters.search) params.set("search", filters.search);

    const res = await api.get(`/transactions?${params.toString()}`);
    setItems(res.data.items);
    setTotalCount(res.data.totalCount);
    setTotalAmount(Number(res.data.totalAmount));
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

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
  }, [user?.uid, load]);

  const pageCount = Math.max(1, Math.ceil(totalCount / 15));

  return (
    <AppLayout title="All expense and repayment transactions">
      <div className="panel p-4 mb-4 grid md:grid-cols-5 gap-3">
        <input
          className="input"
          placeholder="Search title or notes"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <select className="select" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="all">All</option>
          <option value="expense">Expenses</option>
          <option value="shared_share">Shared Expense Shares</option>
          <option value="repayment">Repayments</option>
        </select>
        <select className="select" value={filters.sortOrder} onChange={(e) => setFilters((f) => ({ ...f, sortOrder: e.target.value }))}>
          <option value="DESC">Newest first</option>
          <option value="ASC">Oldest first</option>
        </select>
        <div className="text-sm text-zinc-300 flex items-center">Filtered total: <strong className="ml-1">{totalAmount.toFixed(2)}</strong></div>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="panel p-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Payment Mode</th>
              <th>Role</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.transaction_type}-${item.transaction_id}`}>
                <td>{item.date}</td>
                <td><span className="badge">{item.transaction_type}</span></td>
                <td>{item.title}</td>
                <td>{item.category}</td>
                <td>{Number(item.amount).toFixed(2)}</td>
                <td>{item.payment_mode}</td>
                <td>{item.role}</td>
                <td>{item.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-center mt-4 text-sm">
          <span>Page {page} / {pageCount}</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button className="btn btn-secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default TransactionsPage;
