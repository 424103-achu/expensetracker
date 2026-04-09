import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";

const categories = [
  "Food and Dining",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health and Medical",
  "Education",
  "Utilities",
  "Other"
];

const paymentModes = ["UPI", "Cash", "Credit"];

function ExpensesPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: categories[0],
    expenseDate: today,
    paymentMode: "UPI",
    notes: "",
    isShared: false,
    splitType: "equal"
  });
  const [participants, setParticipants] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [userOptions, setUserOptions] = useState([]);
  const [warning, setWarning] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    amount: "",
    category: categories[0],
    expenseDate: today,
    paymentMode: "UPI",
    notes: ""
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [filters, setFilters] = useState({ category: "All", search: "", sortBy: "date", sortOrder: "DESC" });

  const load = () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    });
    if (filters.category !== "All") params.set("category", filters.category);
    if (filters.search) params.set("search", filters.search);

    api.get(`/expenses?${params.toString()}`).then((res) => {
      setItems(res.data.items);
      setTotalCount(res.data.totalCount);
      setTotalAmount(Number(res.data.totalAmount));
    });
  };

  useEffect(load, [page, filters]);

  useEffect(() => {
    if (!searchUser.trim() || !form.isShared) {
      setUserOptions([]);
      return;
    }

    const timer = setTimeout(() => {
      api.get(`/users/search?q=${encodeURIComponent(searchUser)}`).then((res) => setUserOptions(res.data));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchUser, form.isShared]);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const addParticipant = (user) => {
    if (participants.some((p) => p.uid === user.uid)) return;
    setParticipants((prev) => [...prev, { ...user, assignedCost: "" }]);
    setSearchUser("");
    setUserOptions([]);
  };

  const removeParticipant = (uid) => setParticipants((prev) => prev.filter((p) => p.uid !== uid));

  const submitExpense = async (e) => {
    e.preventDefault();
    setWarning("");
    setSubmitError("");

    const payload = {
      ...form,
      amount: Number(form.amount),
      isShared: Boolean(form.isShared),
      participants: participants.map((p) => ({ uid: p.uid, assignedCost: Number(p.assignedCost || 0) }))
    };

    try {
      const res = await api.post("/expenses", payload);
      if (res.data.warning) {
        setWarning(res.data.warning.message);
      }

      setForm({
        title: "",
        amount: "",
        category: categories[0],
        expenseDate: today,
        paymentMode: "UPI",
        notes: "",
        isShared: false,
        splitType: "equal"
      });
      setParticipants([]);
      load();
    } catch (error) {
      setSubmitError(error.response?.data?.message || "Failed to add expense");
    }
  };

  const deleteExpense = async (id) => {
    await api.delete(`/expenses/${id}`);
    load();
  };

  const startEdit = (item) => {
    setEditingId(item.expense_id);
    setEditForm({
      title: item.title,
      amount: item.amount,
      category: item.category,
      expenseDate: item.expense_date,
      paymentMode: item.payment_mode,
      notes: item.notes || ""
    });
  };

  const saveEdit = async () => {
    await api.put(`/expenses/${editingId}`, {
      ...editForm,
      amount: Number(editForm.amount)
    });
    setEditingId(null);
    load();
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <AppLayout title="Add, filter, and manage expenses">
      {warning ? <div className="panel p-3 mb-4 text-yellow-300">{warning}</div> : null}
      {submitError ? <div className="panel p-3 mb-4 text-red-300">{submitError}</div> : null}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <form onSubmit={submitExpense} className="panel p-4 lg:col-span-2 space-y-3">
          <h2 className="text-xl font-semibold">Add Expense</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" placeholder="Title" value={form.title} onChange={(e) => setField("title", e.target.value)} required />
            <input className="input" placeholder="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setField("amount", e.target.value)} required />
            <select className="select" value={form.category} onChange={(e) => setField("category", e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            <input className="input" type="date" value={form.expenseDate} max={today} onChange={(e) => setField("expenseDate", e.target.value)} required />
            <select className="select" value={form.paymentMode} onChange={(e) => setField("paymentMode", e.target.value)}>
              {paymentModes.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
            <input className="input" placeholder="Notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isShared} onChange={(e) => setField("isShared", e.target.checked)} /> Mark as shared expense</label>

          {form.isShared ? (
            <div className="panel p-3 space-y-3 bg-zinc-900/30">
              <div className="grid md:grid-cols-2 gap-3">
                <select className="select" value={form.splitType} onChange={(e) => setField("splitType", e.target.value)}>
                  <option value="equal">Equal split</option>
                  <option value="custom">Custom split</option>
                </select>
                <input className="input" placeholder="Search user by username/email" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} />
              </div>

              {form.splitType === "custom" ? (
                <p className="text-xs text-zinc-400">In custom split, payer share is auto-calculated as total minus participant shares.</p>
              ) : null}

              {userOptions.length ? (
                <div className="panel p-2">
                  {userOptions.map((u) => (
                    <button type="button" key={u.uid} className="w-full text-left px-2 py-1 hover:bg-zinc-800 rounded" onClick={() => addParticipant(u)}>
                      {u.username} ({u.email})
                    </button>
                  ))}
                </div>
              ) : null}

              {participants.length ? (
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div key={p.uid} className="grid grid-cols-[1fr_150px_auto] gap-2 items-center">
                      <div>{p.username} ({p.email})</div>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        disabled={form.splitType === "equal"}
                        placeholder={form.splitType === "equal" ? "auto" : "assigned"}
                        value={p.assignedCost}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParticipants((prev) => prev.map((x) => x.uid === p.uid ? { ...x, assignedCost: val } : x));
                        }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => removeParticipant(p.uid)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-400">Select participants for shared expense.</p>}
            </div>
          ) : null}

          <button className="btn">Save Expense</button>
        </form>

        <div className="panel p-4 space-y-3">
          <h3 className="text-lg">Filters</h3>
          <select className="select" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option>All</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Search title or notes" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          <select className="select" value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}>
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="title">Title</option>
            <option value="category">Category</option>
          </select>
          <select className="select" value={filters.sortOrder} onChange={(e) => setFilters((f) => ({ ...f, sortOrder: e.target.value }))}>
            <option value="DESC">DESC</option>
            <option value="ASC">ASC</option>
          </select>
          <div className="text-sm text-zinc-300">Total of filtered results: <strong>{totalAmount.toFixed(2)}</strong></div>
        </div>
      </div>

      <div className="panel p-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Payment</th><th>Notes</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.expense_id}>
                <td>
                  {editingId === item.expense_id
                    ? <input className="input" type="date" value={editForm.expenseDate} max={today} onChange={(e) => setEditForm((f) => ({ ...f, expenseDate: e.target.value }))} />
                    : item.expense_date}
                </td>
                <td>
                  {editingId === item.expense_id ? (
                    <input className="input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                  ) : (
                    <>
                      {item.title} {item.is_shared ? <span className="badge">Shared</span> : null}
                    </>
                  )}
                </td>
                <td>
                  {editingId === item.expense_id
                    ? <select className="select" value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
                    : item.category}
                </td>
                <td>
                  {editingId === item.expense_id
                    ? <input className="input" type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} />
                    : Number(item.amount).toFixed(2)}
                </td>
                <td>
                  {editingId === item.expense_id
                    ? <select className="select" value={editForm.paymentMode} onChange={(e) => setEditForm((f) => ({ ...f, paymentMode: e.target.value }))}>{paymentModes.map((mode) => <option key={mode}>{mode}</option>)}</select>
                    : item.payment_mode}
                </td>
                <td>
                  {editingId === item.expense_id
                    ? <input className="input" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                    : (item.notes || "-")}
                </td>
                <td>
                  {editingId === item.expense_id ? (
                    <div className="flex gap-2">
                      <button className="btn" onClick={saveEdit}>Save</button>
                      <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary" onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn btn-secondary" onClick={() => deleteExpense(item.expense_id)}>Delete</button>
                    </div>
                  )}
                </td>
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

export default ExpensesPage;
