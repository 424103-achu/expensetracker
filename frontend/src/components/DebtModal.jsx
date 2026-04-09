import { useState } from "react";

function DebtModal({ open, onClose, onSubmit, title }) {
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ amount: Number(amount), paymentMode, notes });
    setAmount("");
    setNotes("");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="panel w-full max-w-md p-5 space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <input className="input" placeholder="Amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <select className="select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
          <option>UPI</option>
          <option>Cash</option>
          <option>Credit</option>
        </select>
        <textarea className="textarea" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    </div>
  );
}

export default DebtModal;
